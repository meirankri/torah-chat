import type { Route } from "./+types/api.chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatErrorCode } from "~/domain/entities/chat";
import type { ChatMessage } from "~/domain/entities/chat";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import { GeminiClient, chatHistoryToGemini } from "~/infrastructure/gemini/gemini-client";
import { mapSefariaResultsToSources } from "~/application/services/source-service";
import { requireAuth } from "~/lib/auth/middleware";

const MAX_HISTORY_MESSAGES = 10;
const MAX_SEFARIA_SOURCES = 5;
const SEFARIA_TIMEOUT_MS = 8_000;
const GEMINI_EXTRACT_TIMEOUT_MS = 5_000;

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

  // Protect API: require auth if JWT_SECRET is configured
  const jwtSecret = (context.cloudflare.env as Record<string, string>).JWT_SECRET;
  if (jwtSecret) {
    try {
      await requireAuth(request, jwtSecret);
    } catch {
      return chatErrorResponse("UNKNOWN", "Authentication required", 401);
    }
  }

  let body: { content: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return chatErrorResponse("UNKNOWN", "Invalid request body", 400);
  }

  const { content, history = [] } = body;

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

  const env = context.cloudflare.env;
  const geminiApiKey = env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return chatErrorResponse("API_DOWN", "AI service not configured.", 503);
  }

  const baseUrl = env.SEFARIA_BASE_URL || "https://www.sefaria.org";
  const cacheTtl = parseInt(env.SEFARIA_CACHE_TTL_SECONDS || "86400", 10);
  const gemini = new GeminiClient(geminiApiKey);
  const sefaria = new SefariaClient(baseUrl, env.CACHE, cacheTtl);

  // Step 1: Gemini extracts search keywords from the question
  let sefariaResults: SefariaSourceResult[] = [];
  try {
    const keywords = await Promise.race([
      gemini.extractSearchQueries(content.trim()),
      new Promise<string[]>((resolve) =>
        setTimeout(() => resolve([]), GEMINI_EXTRACT_TIMEOUT_MS)
      ),
    ]);

    if (keywords.length > 0) {
      // Step 2: Search Sefaria with the keywords and fetch matching texts
      const searchResults = await Promise.race([
        sefaria.searchByKeywords(keywords, "french", MAX_SEFARIA_SOURCES),
        new Promise<SefariaSourceResult[]>((resolve) =>
          setTimeout(() => resolve([]), SEFARIA_TIMEOUT_MS)
        ),
      ]);

      sefariaResults = searchResults;
    }
  } catch (error) {
    console.error("Sefaria pre-fetch error:", error);
    // Continue without sources
  }

  // Step 3: Build system prompt with source context and stream Gemini response
  const sourceContext = buildSourceContext(sefariaResults);
  const systemPrompt = SYSTEM_PROMPT_BASE + sourceContext;

  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
  const geminiHistory = chatHistoryToGemini(
    recentHistory.map((m) => ({ role: m.role, content: m.content }))
  );

  const sourcesForFrontend = sefariaResults.length > 0
    ? mapSefariaResultsToSources(sefariaResults, "pending")
    : [];

  try {
    const responseText = await gemini.chat(systemPrompt, geminiHistory, content.trim());

    const payload = {
      response: responseText,
      sources: sourcesForFrontend,
    };

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
