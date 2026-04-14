import type { Route } from "./+types/api.conversations.$id.title";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";
import { GeminiClient } from "~/infrastructure/gemini/gemini-client";

const TITLE_GENERATION_PROMPT = `Tu dois générer un titre COURT (5-8 mots maximum) pour une conversation basée sur la question et la réponse ci-dessous.

Règles :
- Le titre doit être dans la MÊME LANGUE que la question
- Maximum 8 mots
- Pas de guillemets autour du titre
- Pas de ponctuation finale
- Retourne UNIQUEMENT le titre, rien d'autre`;

// POST /api/conversations/:id/title — auto-generate title from first exchange
export async function action({ request, params, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;

  let userId: string;
  if (jwtSecret) {
    const auth = await requireAuth(request, jwtSecret);
    userId = auth.userId;
  } else {
    userId = "dev-user";
  }

  const repo = new D1ConversationRepository(env.DB);
  const conversation = await repo.findById(params.id);

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conversation.userId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Already has a title — skip
  if (conversation.title) {
    return Response.json({ title: conversation.title });
  }

  const messages = await repo.getMessages(params.id, 2);
  if (messages.length < 2) {
    return Response.json({ error: "Not enough messages to generate title" }, { status: 400 });
  }

  const userMessage = messages.find((m) => m.role === "user");
  const assistantMessage = messages.find((m) => m.role === "assistant");

  if (!userMessage || !assistantMessage) {
    return Response.json({ error: "Need both user and assistant messages" }, { status: 400 });
  }

  const geminiApiKey = (env as Record<string, string>).GEMINI_API_KEY;
  if (!geminiApiKey) {
    // Fallback: use first 50 chars of user message as title
    const fallbackTitle = userMessage.content.slice(0, 50).trim();
    await repo.update(params.id, { title: fallbackTitle });
    return Response.json({ title: fallbackTitle });
  }

  try {
    const gemini = new GeminiClient(geminiApiKey);
    const prompt = `${TITLE_GENERATION_PROMPT}\n\nQuestion: ${userMessage.content.slice(0, 500)}\n\nRéponse: ${assistantMessage.content.slice(0, 500)}`;

    const title = await gemini.chat(prompt, [], "Génère le titre.");
    const cleanTitle = title.trim().replace(/^["']|["']$/g, "").slice(0, 100);

    await repo.update(params.id, { title: cleanTitle });
    return Response.json({ title: cleanTitle });
  } catch (error) {
    console.error("[Title Generation] Error:", error);
    const fallbackTitle = userMessage.content.slice(0, 50).trim();
    await repo.update(params.id, { title: fallbackTitle });
    return Response.json({ title: fallbackTitle });
  }
}
