import type { Route } from "./+types/api.chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatErrorCode } from "~/domain/entities/chat";
import type { ChatMessage } from "~/domain/entities/chat";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import { GeminiClient, chatHistoryToGemini } from "~/infrastructure/gemini/gemini-client";
import { mapSefariaResultsToSources } from "~/application/services/source-service";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

const MAX_HISTORY_MESSAGES = 10;
const MAX_SEFARIA_SOURCES = 5;
const SEFARIA_TIMEOUT_MS = 15_000;
const GEMINI_EXTRACT_TIMEOUT_MS = 10_000;

function chatErrorResponse(code: ChatErrorCode, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

function buildSourceContext(sources: SefariaSourceResult[]): string {
  if (sources.length === 0) return "";

  const parts = sources.map((s) => {
    let text = `[${s.ref}]`;
    if (s.textHebrew) text += `\nHébreu : ${s.textHebrew}`;
    if (s.textTranslation) text += `\nTraduction : ${s.textTranslation}`;
    return text;
  });

  return `\n\nSOURCES DISPONIBLES (vérifiées sur Sefaria) :\n${parts.join("\n\n")}`;
}

const SYSTEM_PROMPT_BASE = `Tu es un assistant spécialisé dans les textes juifs (Torah, Talmud, Midrash, Halakha, Hassidout, Kabbale, Moussar).

RÈGLES OBLIGATOIRES :
1. Utilise EN PRIORITÉ les sources fournies ci-dessous pour appuyer ta réponse. Cite-les avec leur référence exacte.
2. Si les sources fournies ne suffisent pas, tu peux compléter avec tes connaissances mais PRÉCISE que ces sources supplémentaires ne sont pas vérifiées sur Sefaria.
3. Ne JAMAIS inventer de sources. Si tu ne connais pas la source exacte, dis-le explicitement.
4. Répondre dans la langue de la question (français, anglais ou hébreu).
5. Quand un sujet fait l'objet d'une ma'hloket (divergence d'opinions), présenter les différents avis avec leurs sources.
6. Ne JAMAIS émettre de psak halakha. Toujours renvoyer à un rav compétent pour les questions pratiques.
7. Utiliser la translittération courante pour les termes hébraïques (ex: "Shabbat" pas "Sabbath").
8. Structurer les réponses avec des paragraphes clairs et du markdown.

FORMAT DE RÉPONSE :
- Réponse claire et structurée en markdown
- Sources citées entre crochets : [Talmud Bavli, Kiddoushin 31a]
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

  const geminiApiKey = (env as Record<string, string>).GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return chatErrorResponse("API_DOWN", "AI service not configured.", 503);
  }

  const baseUrl = (env as Record<string, string>).SEFARIA_BASE_URL || "https://www.sefaria.org";
  const cacheTtl = parseInt((env as Record<string, string>).SEFARIA_CACHE_TTL_SECONDS || "86400", 10);
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
  const contextHistory = dbHistory.length > 0
    ? dbHistory
    : history.map((m) => ({ role: m.role, content: m.content }));

  // Step 1: Gemini extracts search keywords from the question
  let sefariaResults: SefariaSourceResult[] = [];
  let sourcesError: string | undefined;
  try {
    console.log(`[Chat API] Step 1: Extracting keywords for "${content.trim().slice(0, 80)}..."`);
    const keywords = await Promise.race([
      gemini.extractSearchQueries(content.trim()),
      new Promise<string[]>((resolve) =>
        setTimeout(() => {
          console.warn("[Chat API] Gemini keyword extraction timed out");
          resolve([]);
        }, GEMINI_EXTRACT_TIMEOUT_MS)
      ),
    ]);

    console.log(`[Chat API] Keywords extracted: ${keywords.length > 0 ? keywords.join(", ") : "(none)"}`);

    if (keywords.length > 0) {
      // Step 2: Search Sefaria with the keywords and fetch matching texts
      console.log("[Chat API] Step 2: Searching Sefaria by keywords...");
      const searchResults = await Promise.race([
        sefaria.searchByKeywords(keywords, "french", MAX_SEFARIA_SOURCES),
        new Promise<SefariaSourceResult[]>((resolve) =>
          setTimeout(() => {
            console.warn("[Chat API] Sefaria keyword search timed out");
            resolve([]);
          }, SEFARIA_TIMEOUT_MS)
        ),
      ]);

      sefariaResults = searchResults;
      console.log(`[Chat API] Sefaria keyword search: ${sefariaResults.length} results`);

      // Step 2b: Fallback to find-refs if keyword search returned nothing
      if (sefariaResults.length === 0) {
        console.log("[Chat API] Step 2b: Fallback — trying Sefaria find-refs (Linker API)...");
        const fallbackResults = await Promise.race([
          sefaria.getSourcesForText(content.trim(), "french", MAX_SEFARIA_SOURCES),
          new Promise<SefariaSourceResult[]>((resolve) =>
            setTimeout(() => {
              console.warn("[Chat API] Sefaria find-refs fallback timed out");
              resolve([]);
            }, SEFARIA_TIMEOUT_MS)
          ),
        ]);
        sefariaResults = fallbackResults;
        console.log(`[Chat API] Sefaria find-refs fallback: ${sefariaResults.length} results`);
      }
    } else {
      sourcesError = "Impossible d'extraire des mots-clés pour la recherche de sources.";
    }
  } catch (error) {
    console.error("[Chat API] Sources fetch error:", error);
    sourcesError = "Erreur lors de la recherche des sources.";
  }

  if (sefariaResults.length === 0 && !sourcesError) {
    sourcesError = "Aucune source trouvée pour cette question.";
  }

  // Step 3: Build system prompt with source context
  const sourceContext = buildSourceContext(sefariaResults);
  const systemPrompt = SYSTEM_PROMPT_BASE + sourceContext;

  const recentHistory = contextHistory.slice(-MAX_HISTORY_MESSAGES);
  const geminiHistory = chatHistoryToGemini(recentHistory);

  const sourcesForFrontend = sefariaResults.length > 0
    ? mapSefariaResultsToSources(sefariaResults, "pending")
    : [];

  try {
    const responseText = await gemini.chat(systemPrompt, geminiHistory, content.trim());

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

    return Response.json(payload);
  } catch (error) {
    console.error("Chat API error:", error);
    return chatErrorResponse(
      "API_DOWN",
      "The AI service is temporarily unavailable. Please try again later.",
      503
    );
  }
}
