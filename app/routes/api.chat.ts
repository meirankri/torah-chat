import type { Route } from "./+types/api.chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatErrorCode } from "~/domain/entities/chat";
import type { ChatMessage } from "~/domain/entities/chat";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import { GeminiClient, chatHistoryToGemini } from "~/infrastructure/gemini/gemini-client";
import { mapAgentSourcesToSources, mapCustomSourcesToSources } from "~/application/services/source-service";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { checkAndIncrementQuota, getModelForPlan, isGeminiEligible } from "~/application/services/quota-service";
import { checkRateLimit } from "~/lib/rate-limit";
import { retrieveCustomSources } from "~/application/services/rag-service";
import type { CustomSource } from "~/application/services/rag-service";
import { searchAgent, buildAgentSourceContext } from "~/application/services/search-agent";
import type { AgentSource } from "~/application/services/search-agent";
import { retrieveSefariaRagSources, buildSefariaRagContext } from "~/application/services/sefaria-rag-service";
import { mapSefariaRagSourcesToSources } from "~/application/services/source-service";
import { buildCustomSourceContext } from "~/lib/chat-keywords";

const MAX_HISTORY_MESSAGES = 10;
const LLM_TIMEOUT_MS = 30_000;

function chatErrorResponse(code: ChatErrorCode, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

async function callWorkersAI(
  env: { AI?: unknown },
  model: string,
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string
): Promise<string> {
  if (!env.AI) throw new Error("Workers AI binding not available");
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];
  const aiResult = await (env.AI as {
    run: (model: string, input: { messages: typeof messages }) => Promise<{ response?: string }>;
  }).run(model, { messages });
  if (!aiResult.response) throw new Error("Workers AI returned empty response");
  return aiResult.response;
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

  let body: { content: string; history?: ChatMessage[]; conversationId?: string; model?: "standard" | "premium" };
  try {
    body = await request.json();
  } catch {
    return chatErrorResponse("UNKNOWN", "Invalid request body", 400);
  }

  const { content, history = [], conversationId, model: requestedModel } = body;
  const selectedModel = requestedModel === "premium" ? "premium" : "standard";

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

  // Determine model based on user plan
  let userPlanForModel: import("~/domain/entities/user").UserPlan = "free_trial";
  let geminiCreditsRemaining = 0;
  if (userId && env.DB) {
    const userForModel = await new D1UserRepository(env.DB).findById(userId);
    if (userForModel) {
      userPlanForModel = userForModel.plan;
      geminiCreditsRemaining = userForModel.geminiCredits;
    }
  }
  const workersAiModel = getModelForPlan(userPlanForModel, env as Record<string, string>);

  // Premium model eligibility check
  const useGemini = selectedModel === "premium" && isGeminiEligible(userPlanForModel, geminiCreditsRemaining);
  if (selectedModel === "premium" && !useGemini) {
    return chatErrorResponse(
      "QUOTA_EXCEEDED",
      "Vos crédits Premium sont épuisés. Passez à un plan payant pour des réponses plus précises.",
      429
    );
  }

  // Decrement Gemini credits if using Premium
  if (useGemini && userPlanForModel === "free_trial" && userId && env.DB) {
    const userRepo = new D1UserRepository(env.DB);
    geminiCreditsRemaining = await userRepo.decrementGeminiCredits(userId);
  }

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

  // Source retrieval + LLM response — dual pipeline based on selectedModel
  let sourcesError: string | undefined;
  let sourceContext = "";
  let sourcesForFrontend: ReturnType<typeof mapAgentSourcesToSources> = [];

  const vectorizeSefaria = (env as Record<string, unknown>).VECTORIZE_SEFARIA as
    | { query: (vector: number[], options: { topK: number; returnMetadata?: string; filter?: Record<string, unknown> }) => Promise<{ matches: Array<{ id: string; score: number; metadata?: Record<string, string> }> }> }
    | undefined;

  if (useGemini) {
    // ── PREMIUM pipeline: Search Agent (Gemini function calling) ──
    let agentSources: AgentSource[] = [];
    if (geminiApiKey && env.DB) {
      try {
        const agentResult = await searchAgent(
          { geminiKey: geminiApiKey, vectorize: vectorizeSefaria ?? null, sefaria, db: env.DB },
          content.trim()
        );
        agentSources = agentResult.sources;
        console.log(`[Chat API] Premium Agent: ${agentSources.length} sources in ${agentResult.iterations} iterations`);
      } catch (err) {
        console.error("[Chat API] Premium Agent failed:", err);
        sourcesError = "Erreur lors de la recherche des sources.";
      }
    }
    sourceContext = buildAgentSourceContext(agentSources);
    sourcesForFrontend = agentSources.length > 0 ? mapAgentSourcesToSources(agentSources, "pending") : [];
  } else {
    // ── STANDARD pipeline: RAG direct (Gemini Embedding + Vectorize, no agent) ──
    if (geminiApiKey && vectorizeSefaria && env.DB) {
      try {
        const ragSources = await retrieveSefariaRagSources(geminiApiKey, vectorizeSefaria, env.DB, content.trim(), 5, 0.4);
        console.log(`[Chat API] Standard RAG: ${ragSources.length} sources`);
        sourceContext = buildSefariaRagContext(ragSources);
        sourcesForFrontend = ragSources.length > 0 ? mapSefariaRagSourcesToSources(ragSources, "pending") : [];
      } catch (err) {
        console.error("[Chat API] Standard RAG failed:", err);
        sourcesError = "Erreur lors de la recherche des sources.";
      }
    }
  }

  // Custom sources (always)
  let customSources: CustomSource[] = [];
  if (env.AI && env.DB) {
    const vectorize = (env as Record<string, unknown>).VECTORIZE as Parameters<typeof retrieveCustomSources>[1];
    if (vectorize) {
      customSources = await retrieveCustomSources(
        env.AI as Parameters<typeof retrieveCustomSources>[0], vectorize, env.DB, content.trim(), 3
      );
      if (customSources.length > 0) {
        console.log(`[Chat API] RAG custom: ${customSources.length} custom sources`);
      }
    }
  }

  if (sourcesForFrontend.length === 0 && customSources.length === 0 && !sourcesError) {
    sourcesError = "Aucune source trouvée pour cette question.";
  }

  const fullSourceContext = sourceContext + buildCustomSourceContext(customSources);
  const systemPrompt = SYSTEM_PROMPT_BASE + fullSourceContext;

  const recentHistory = contextHistory.slice(-MAX_HISTORY_MESSAGES);
  const geminiHistory = chatHistoryToGemini(recentHistory);

  const customSourcesForFrontend = customSources.length > 0 ? mapCustomSourcesToSources(customSources, "pending") : [];
  sourcesForFrontend = [...sourcesForFrontend, ...customSourcesForFrontend];

  // ── LLM Response ──
  let responseText: string;
  if (useGemini) {
    // Premium: Gemini chat
    try {
      responseText = await Promise.race([
        gemini.chat(systemPrompt, geminiHistory, content.trim()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), LLM_TIMEOUT_MS)),
      ]);
    } catch (err) {
      if (err instanceof Error && err.message === "LLM timeout") {
        return chatErrorResponse("API_DOWN", "La réponse prend plus de temps que prévu. Veuillez réessayer.", 503);
      }
      // Fallback to Workers AI
      console.warn("[Chat API] Premium Gemini failed, falling back to Workers AI");
      responseText = await callWorkersAI(env, workersAiModel, systemPrompt, recentHistory, content.trim());
    }
  } else {
    // Standard: Workers AI (Llama 70B) directly
    responseText = await callWorkersAI(env, workersAiModel, systemPrompt, recentHistory, content.trim());
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
    geminiCreditsRemaining: number;
    modelUsed: "standard" | "premium";
  } = {
    response: responseText,
    sources: sourcesForFrontend,
    geminiCreditsRemaining,
    modelUsed: useGemini ? "premium" : "standard",
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
