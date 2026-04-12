import type { Route } from "./+types/api.chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatErrorCode } from "~/domain/entities/chat";
import { buildLLMMessages } from "~/application/services/chat-service";
import type { ChatMessage } from "~/domain/entities/chat";

const MAX_HISTORY_MESSAGES = 10;
const LLM_TIMEOUT_MS = 30_000;

function chatErrorResponse(code: ChatErrorCode, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return chatErrorResponse("UNKNOWN", "Method not allowed", 405);
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
  const model = env.WORKERS_AI_MODEL_FREE || "@cf/meta/llama-3.1-8b-instruct";

  // Read system prompt from config file bundled at build time
  const systemPrompt = `Tu es un assistant spécialisé dans les textes juifs (Torah, Talmud, Midrash, Halakha, Hassidout, Kabbale, Moussar).

RÈGLES OBLIGATOIRES :
1. Toujours citer les sources précises au format Sefaria (ex: "Talmud Bavli, Berakhot 5a", "Rambam, Hilkhot Teshouva 3:4")
2. Ne JAMAIS inventer de sources. Si tu ne connais pas la source exacte, dis-le explicitement.
3. Répondre dans la langue de la question (français, anglais ou hébreu).
4. Quand un sujet fait l'objet d'une ma'hloket (divergence d'opinions), présenter les différents avis avec leurs sources.
5. Ne JAMAIS émettre de psak halakha. Toujours renvoyer à un rav compétent pour les questions pratiques.
6. Utiliser la translittération courante pour les termes hébraïques (ex: "Shabbat" pas "Sabbath").
7. Structurer les réponses avec des paragraphes clairs.

FORMAT DE RÉPONSE :
- Réponse claire et structurée
- Sources citées entre crochets : [Talmud Bavli, Kiddoushin 31a]
- Disclaimer systématique en fin de réponse`;

  const messages = buildLLMMessages(systemPrompt, history, MAX_HISTORY_MESSAGES);
  // Add the current user message
  messages.push({ role: "user", content: content.trim() });

  try {
    const aiResponse = await Promise.race([
      env.AI.run(model, {
        messages,
        stream: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM_TIMEOUT")), LLM_TIMEOUT_MS)
      ),
    ]);

    // Workers AI streaming returns a ReadableStream
    const stream = aiResponse as ReadableStream;

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LLM_TIMEOUT") {
      return chatErrorResponse(
        "TIMEOUT",
        "Response is taking too long. Please try again.",
        504
      );
    }

    console.error("Chat API error:", error);
    return chatErrorResponse(
      "API_DOWN",
      "The AI service is temporarily unavailable. Please try again later.",
      503
    );
  }
}
