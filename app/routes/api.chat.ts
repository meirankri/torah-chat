import type { Route } from "./+types/api.chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatErrorCode } from "~/domain/entities/chat";
import type { ChatMessage } from "~/domain/entities/chat";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import { GeminiClient, chatHistoryToGemini } from "~/infrastructure/gemini/gemini-client";
import { mapSefariaResultsToSources, mapCustomSourcesToSources, mapSefariaRagSourcesToSources } from "~/application/services/source-service";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { checkAndIncrementQuota, getModelForPlan } from "~/application/services/quota-service";
import { checkRateLimit } from "~/lib/rate-limit";
import { retrieveCustomSources } from "~/application/services/rag-service";
import type { CustomSource } from "~/application/services/rag-service";
import { retrieveSefariaRagSources, buildSefariaRagContext } from "~/application/services/sefaria-rag-service";
import type { SefariaRagSource } from "~/application/services/sefaria-rag-service";
import { extractKeywordsFromQuestion, buildSourceContext, buildCustomSourceContext } from "~/lib/chat-keywords";

const MAX_HISTORY_MESSAGES = 10;
const MAX_SEFARIA_SOURCES = 5;
const SEFARIA_TIMEOUT_MS = 15_000;
const GEMINI_EXTRACT_TIMEOUT_MS = 10_000;
const LLM_TIMEOUT_MS = 30_000;

function chatErrorResponse(code: ChatErrorCode, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

const SYSTEM_PROMPT_BASE = `Tu es un assistant spécialisé dans les textes juifs (Torah, Talmud, Midrash, Halakha, Hassidout, Kabbale, Moussar).

RÈGLES OBLIGATOIRES DE CITATION :
1. Tu DOIS baser ta réponse UNIQUEMENT sur les sources listées dans la section "SOURCES SEFARIA" ci-dessous.
2. Tu ne cites QUE les refs qui apparaissent EXACTEMENT dans les sources fournies. Tu utilises leur nom complet tel qu'affiché (ex: "Rashi on Numbers 20:12:1", "Berakhot 2a:1").
3. INTERDIT ABSOLU : ne JAMAIS écrire "selon Rashi", "selon Rambam", "selon Ramban", "selon le Talmud" si le nom du commentateur ou de l'ouvrage n'est pas explicitement présent dans les sources fournies. Si tu veux mentionner un commentateur qui n'est pas dans les sources, abstiens-toi.
4. Si les sources fournies ne contiennent pas d'information sur la question, dis-le clairement : "Les sources fournies ne traitent pas directement de cette question." N'INVENTE PAS de réponse.
5. Chaque affirmation factuelle doit être suivie du ref exact entre crochets.

AUTRES RÈGLES :
6. Répondre dans la langue de la question (français, anglais ou hébreu).
7. Quand un sujet fait l'objet d'une ma'hloket (divergence d'opinions), présenter les différents avis avec leurs sources.
8. Ne JAMAIS émettre de psak halakha. Toujours renvoyer à un rav compétent pour les questions pratiques.
9. Utiliser la translittération courante pour les termes hébraïques (ex: "Shabbat" pas "Sabbath").
10. Structurer les réponses avec des paragraphes clairs et du markdown.

FORMAT DE RÉPONSE :
- Réponse claire et structurée en markdown
- Sources citées entre crochets avec le ref EXACT de la section SOURCES SEFARIA
- Disclaimer en fin de réponse : rappeler de consulter un rav pour toute question pratique`;

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return chatErrorResponse("UNKNOWN", "Method not allowed", 405);
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;

  let userId: string | null = null;
  if (jwtSecret) {
    try {
      const auth = await requireAuth(request, jwtSecret);
      userId = auth.userId;
    } catch {
      return chatErrorResponse("UNKNOWN", "Authentication required", 401);
    }
  }

  // Rate limiting: 30 req/min per user (or IP if no user)
  if (env.CACHE) {
    const rateLimitKey = userId ?? (request.headers.get("CF-Connecting-IP") ?? "anonymous");
    const rl = await checkRateLimit(env.CACHE, rateLimitKey);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ code: "RATE_LIMITED", message: "Trop de requêtes. Veuillez patienter avant de réessayer." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rl.resetAt - Math.floor(Date.now() / 1000)),
          },
        }
      );
    }
  }

  let body: { content: string; history?: ChatMessage[]; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return chatErrorResponse("UNKNOWN", "Invalid request body", 400);
  }

  const { content, history = [], conversationId } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return chatErrorResponse("UNKNOWN", "Message content is required", 400);
  }

  if (content.length > MAX_INPUT_LENGTH) {
    return chatErrorResponse(
      "INPUT_TOO_LONG",
      `Message too long. Maximum ${MAX_INPUT_LENGTH} characters.`,
      400
    );
  }

  // Quota check: enforce per-plan limits and model selection
  let quotaInfo: { used: number; limit: number | null } | undefined;
  if (userId && env.DB) {
    const userRepo = new D1UserRepository(env.DB);
    const user = await userRepo.findById(userId);

    if (user) {
      const standardLimit = parseInt(
        (env as Record<string, string>).PLAN_STANDARD_QUESTIONS_LIMIT || "500",
        10
      );
      const premiumLimit = parseInt(
        (env as Record<string, string>).PLAN_PREMIUM_QUESTIONS_LIMIT || "2000",
        10
      );
      const quotaResult = await checkAndIncrementQuota(user, userRepo, {
        standardLimit,
        premiumLimit,
      });

      if (!quotaResult.allowed) {
        const errorMessages: Record<string, string> = {
          quota_exceeded: `Vous avez atteint votre limite de ${quotaResult.questionsLimit} questions ce mois. Passez à un plan supérieur pour continuer.`,
          plan_expired: "Votre plan a expiré. Veuillez vous abonner pour continuer.",
          trial_expired: "Votre période d'essai a expiré. Veuillez vous abonner pour continuer.",
        };
        return chatErrorResponse(
          "QUOTA_EXCEEDED",
          errorMessages[quotaResult.reason ?? "quota_exceeded"] ?? "Quota dépassé.",
          429
        );
      }

      quotaInfo = { used: quotaResult.questionsUsed, limit: quotaResult.questionsLimit };
    }
  }

  const geminiApiKey = (env as Record<string, string>).GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return chatErrorResponse("API_DOWN", "AI service not configured.", 503);
  }

  // Determine model based on user plan (switch LLM by plan)
  let userPlanForModel: import("~/domain/entities/user").UserPlan = "free_trial";
  if (userId && env.DB) {
    const userForModel = await new D1UserRepository(env.DB).findById(userId);
    if (userForModel) userPlanForModel = userForModel.plan;
  }
  // Determine Workers AI model (used as fallback if Gemini fails)
  const workersAiModel = getModelForPlan(userPlanForModel, env as Record<string, string>);

  const baseUrl = (env as Record<string, string>).SEFARIA_BASE_URL || "https://www.sefaria.org";
  const cacheTtl = parseInt(
    (env as Record<string, string>).SEFARIA_CACHE_TTL_SECONDS || "86400",
    10
  );
  const gemini = new GeminiClient(geminiApiKey);
  const sefaria = new SefariaClient(baseUrl, env.CACHE, cacheTtl);

  // Load conversation context from DB if available
  const repo = env.DB ? new D1ConversationRepository(env.DB) : null;
  let dbConversationId = conversationId;
  let dbHistory: { role: "user" | "assistant"; content: string }[] = [];

  if (repo && userId) {
    if (!dbConversationId) {
      const conversation = await repo.create(userId);
      dbConversationId = conversation.id;
    } else {
      const conversation = await repo.findById(dbConversationId);
      if (!conversation || conversation.userId !== userId) {
        return chatErrorResponse("UNKNOWN", "Conversation not found", 404);
      }
    }

    const dbMessages = await repo.getMessages(dbConversationId);
    dbHistory = dbMessages.map((m) => ({ role: m.role, content: m.content }));
  }

  // Use DB history if available, otherwise use client-sent history
  const contextHistory =
    dbHistory.length > 0 ? dbHistory : history.map((m) => ({ role: m.role, content: m.content }));

  // Step 0: RAG Sefaria — retrieve via Gemini Embedding + Vectorize (priority source).
  // On demande topK=10 avec minScore=0.4 puis on filtre agressivement :
  //   - On garde top-5
  //   - On rejette celles dont le score est trop en retrait du top (> 0.1 de gap)
  //   - On skip le fallback Sefaria ES si le top score ≥ 0.48 ET ≥ 3 sources.
  let sefariaRagSources: SefariaRagSource[] = [];
  const vectorizeSefaria = (env as Record<string, unknown>).VECTORIZE_SEFARIA as
    | Parameters<typeof retrieveSefariaRagSources>[1]
    | undefined;
  if (geminiApiKey && vectorizeSefaria && env.DB) {
    try {
      const rawMatches = await retrieveSefariaRagSources(
        geminiApiKey,
        vectorizeSefaria,
        env.DB,
        content.trim(),
        10,
        0.4
      );
      // Filtre par gap : si le top = 0.55, on garde celles >= 0.45
      const topScore = rawMatches[0]?.score ?? 0;
      const minByGap = topScore - 0.1;
      sefariaRagSources = rawMatches.filter((s) => s.score >= minByGap).slice(0, 5);
      console.log(
        `[Chat API] Step 0: RAG Sefaria ${sefariaRagSources.length}/${rawMatches.length} sources (top=${topScore.toFixed(3)}, gap-min=${minByGap.toFixed(3)})`
      );
    } catch (err) {
      console.error("[Chat API] RAG Sefaria failed:", err);
    }
  }
  const topRagScore = sefariaRagSources[0]?.score ?? 0;
  const skipFallback = sefariaRagSources.length >= 3 && topRagScore >= 0.48;

  // Step 1: Gemini extracts search keywords + book refs from the question (fallback).
  let sefariaResults: SefariaSourceResult[] = [];
  let sourcesError: string | undefined;
  const emptyExtraction = { queries: [] as string[], refs: [] as string[] };
  if (!skipFallback) try {
    console.log(
      `[Chat API] Step 1: Extracting keywords + refs for "${content.trim().slice(0, 80)}..."`
    );
    const extraction = await Promise.race([
      gemini.extractSearchQueries(content.trim()),
      new Promise<typeof emptyExtraction>((resolve) =>
        setTimeout(() => {
          console.warn("[Chat API] Gemini extraction timed out");
          resolve(emptyExtraction);
        }, GEMINI_EXTRACT_TIMEOUT_MS)
      ),
    ]);

    const { queries: keywords, refs } = extraction;
    console.log(`[Chat API] Extracted: ${keywords.length} keyword groups, ${refs.length} refs`);

    // Step 2a: Search by direct refs (book/treatise names)
    if (refs.length > 0) {
      console.log("[Chat API] Step 2a: Searching Sefaria by refs...", refs);
      const refResults = await Promise.race([
        sefaria.searchByRefs(refs, keywords, "french", MAX_SEFARIA_SOURCES),
        new Promise<SefariaSourceResult[]>((resolve) =>
          setTimeout(() => {
            console.warn("[Chat API] Sefaria ref search timed out");
            resolve([]);
          }, SEFARIA_TIMEOUT_MS)
        ),
      ]);
      sefariaResults = refResults;
      console.log(`[Chat API] Sefaria ref search: ${sefariaResults.length} results`);
    }

    // Step 2b: Search by keywords (full-text), fill remaining slots
    const remainingSlots = MAX_SEFARIA_SOURCES - sefariaResults.length;
    if (keywords.length > 0 && remainingSlots > 0) {
      console.log("[Chat API] Step 2b: Searching Sefaria by keywords...");
      const keywordResults = await Promise.race([
        sefaria.searchByKeywords(keywords, "french", remainingSlots),
        new Promise<SefariaSourceResult[]>((resolve) =>
          setTimeout(() => {
            console.warn("[Chat API] Sefaria keyword search timed out");
            resolve([]);
          }, SEFARIA_TIMEOUT_MS)
        ),
      ]);

      // Merge, avoiding duplicate refs
      const existingRefs = new Set(sefariaResults.map((s) => s.ref));
      for (const result of keywordResults) {
        if (!existingRefs.has(result.ref)) {
          sefariaResults.push(result);
          existingRefs.add(result.ref);
        }
      }
      console.log(`[Chat API] After keyword search: ${sefariaResults.length} total results`);
    }

    // Step 2c: Fallback — search using raw question words when Gemini returned nothing
    if (sefariaResults.length === 0) {
      console.log("[Chat API] Step 2c: Fallback — direct keyword search from raw question...");
      // Extract meaningful words (>3 chars) from the question as a best-effort search
      const rawKeywords = extractKeywordsFromQuestion(content.trim());
      console.log(`[Chat API] Step 2c: raw keywords = ${rawKeywords.join(", ")}`);
      if (rawKeywords.length > 0) {
        const fallbackResults = await Promise.race([
          sefaria.searchByKeywords(rawKeywords, "french", MAX_SEFARIA_SOURCES),
          new Promise<SefariaSourceResult[]>((resolve) =>
            setTimeout(() => {
              console.warn("[Chat API] Sefaria raw-keyword fallback timed out");
              resolve([]);
            }, SEFARIA_TIMEOUT_MS)
          ),
        ]);
        sefariaResults = fallbackResults;
        console.log(`[Chat API] Step 2c: ${sefariaResults.length} results from raw-keyword fallback`);
      }
    }

  } catch (error) {
    console.error("[Chat API] Sources fetch error:", error);
    sourcesError = "Erreur lors de la recherche des sources.";
  }

  if (sefariaResults.length === 0 && sefariaRagSources.length === 0 && !sourcesError) {
    sourcesError = "Aucune source trouvée pour cette question.";
  }

  // Step 3a: RAG — retrieve custom Torah sources from Vectorize
  let customSources: CustomSource[] = [];
  if (env.AI && env.DB) {
    const vectorize = (env as Record<string, unknown>).VECTORIZE as Parameters<typeof retrieveCustomSources>[1];
    if (vectorize) {
      customSources = await retrieveCustomSources(
        env.AI as Parameters<typeof retrieveCustomSources>[0],
        vectorize,
        env.DB,
        content.trim(),
        3
      );
      if (customSources.length > 0) {
        console.log(`[Chat API] RAG: ${customSources.length} custom sources retrieved`);
      }
    }
  }

  // Step 3b: Build system prompt with RAG Sefaria + ES Sefaria + custom source context
  const sourceContext =
    buildSefariaRagContext(sefariaRagSources) +
    buildSourceContext(sefariaResults) +
    buildCustomSourceContext(customSources);
  const systemPrompt = SYSTEM_PROMPT_BASE + sourceContext;

  const recentHistory = contextHistory.slice(-MAX_HISTORY_MESSAGES);
  const geminiHistory = chatHistoryToGemini(recentHistory);

  const sefariaRagForFrontend =
    sefariaRagSources.length > 0 ? mapSefariaRagSourcesToSources(sefariaRagSources, "pending") : [];
  const sefariaSourcesForFrontend =
    sefariaResults.length > 0 ? mapSefariaResultsToSources(sefariaResults, "pending") : [];
  const customSourcesForFrontend =
    customSources.length > 0 ? mapCustomSourcesToSources(customSources, "pending") : [];
  const sourcesForFrontend = [
    ...sefariaRagForFrontend,
    ...sefariaSourcesForFrontend,
    ...customSourcesForFrontend,
  ];

  let responseText: string;
  try {
    responseText = await Promise.race([
      gemini.chat(systemPrompt, geminiHistory, content.trim()),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("LLM timeout")),
          LLM_TIMEOUT_MS
        )
      ),
    ]);
  } catch (geminiError) {
    if (geminiError instanceof Error && geminiError.message === "LLM timeout") {
      console.warn("[Chat API] Gemini chat timed out after", LLM_TIMEOUT_MS, "ms");
      return chatErrorResponse(
        "API_DOWN",
        "La réponse prend plus de temps que prévu. Veuillez réessayer.",
        503
      );
    }
    console.warn(
      "[Chat API] Gemini failed, trying Workers AI fallback with model:",
      workersAiModel,
      geminiError instanceof Error ? geminiError.message : geminiError
    );

    if (!env.AI) {
      console.error("[Chat API] Workers AI binding (env.AI) not available");
      return chatErrorResponse("API_DOWN", "AI service is temporarily unavailable.", 503);
    }

    try {
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...recentHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: content.trim() },
      ];

      const aiResult = await (env.AI as {
        run: (
          model: string,
          input: { messages: typeof messages }
        ) => Promise<{ response?: string }>;
      }).run(workersAiModel, { messages });

      if (!aiResult.response) {
        throw new Error("Workers AI returned empty response");
      }
      responseText = aiResult.response;
      console.log("[Chat API] Workers AI fallback succeeded");
    } catch (fallbackError) {
      console.error("[Chat API] Workers AI fallback also failed:", fallbackError);
      return chatErrorResponse("API_DOWN", "AI service is temporarily unavailable.", 503);
    }
  }

  // Save messages to DB if we have a conversation
  if (repo && dbConversationId) {
    try {
      await repo.addMessage(dbConversationId, "user", content.trim());
      const assistantMsg = await repo.addMessage(dbConversationId, "assistant", responseText);

      if (sourcesForFrontend.length > 0) {
        const sourcesWithMessageId = sourcesForFrontend.map((s) => ({
          ...s,
          messageId: assistantMsg.id,
        }));
        await repo.addSources(sourcesWithMessageId);
      }
    } catch (dbError) {
      console.error("[Chat API] DB save error (non-blocking):", dbError);
    }
  }

  const payload: {
    response: string;
    sources: typeof sourcesForFrontend;
    sourcesError?: string;
    conversationId?: string;
    quotaInfo?: { used: number; limit: number | null };
  } = {
    response: responseText,
    sources: sourcesForFrontend,
  };

  if (sourcesError) {
    payload.sourcesError = sourcesError;
  }

  if (dbConversationId) {
    payload.conversationId = dbConversationId;
  }

  if (quotaInfo) {
    payload.quotaInfo = quotaInfo;
  }

  return Response.json(payload);
}
