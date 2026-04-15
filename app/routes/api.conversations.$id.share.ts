import type { Route } from "./+types/api.conversations.$id.share";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

// POST /api/conversations/:id/share — create or retrieve share token
// DELETE /api/conversations/:id/share — revoke share link
export async function action({ request, params, context }: Route.ActionArgs) {
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

  if (request.method === "POST") {
    // Check if already shared
    const existing = await env.DB.prepare(
      "SELECT token FROM shared_conversations WHERE conversation_id = ?"
    )
      .bind(params.id)
      .first<{ token: string }>();

    if (existing) {
      return Response.json({ token: existing.token });
    }

    // Create a new share token (16 bytes = 32 hex chars, URL-safe)
    const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO shared_conversations (id, conversation_id, token, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(id, params.id, token, now)
      .run();

    return Response.json({ token }, { status: 201 });
  }

  if (request.method === "DELETE") {
    await env.DB.prepare(
      "DELETE FROM shared_conversations WHERE conversation_id = ?"
    )
      .bind(params.id)
      .run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

// GET /api/conversations/:id/share — get current share status
export async function loader({ request, params, context }: Route.LoaderArgs) {
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

  const row = await env.DB.prepare(
    "SELECT token FROM shared_conversations WHERE conversation_id = ?"
  )
    .bind(params.id)
    .first<{ token: string }>();

  return Response.json({ token: row?.token ?? null });
}
