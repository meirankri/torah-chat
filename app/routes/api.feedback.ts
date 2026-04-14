import type { Route } from "./+types/api.feedback";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;

  if (!jwtSecret) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let userId: string;
  try {
    const auth = await requireAuth(request, jwtSecret);
    userId = auth.userId;
  } catch {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: { messageId: string; rating: 1 | -1 };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messageId, rating } = body;

  if (!messageId || typeof messageId !== "string") {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }

  if (rating !== 1 && rating !== -1) {
    return Response.json({ error: "rating must be 1 or -1" }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ error: "Database not available" }, { status: 503 });
  }

  const repo = new D1ConversationRepository(env.DB);

  try {
    await repo.saveFeedback(messageId, userId, rating);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[Feedback API] Error saving feedback:", error);
    return Response.json({ error: "Failed to save feedback" }, { status: 500 });
  }
}
