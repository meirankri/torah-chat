import type { Route } from "./+types/api.conversations.$id";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

// GET /api/conversations/:id — get conversation with messages
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

  const messages = await repo.getMessages(params.id);

  // Load sources for each assistant message
  const messagesWithSources = await Promise.all(
    messages.map(async (msg) => {
      if (msg.role === "assistant") {
        const sources = await repo.getSourcesForMessage(msg.id);
        return { ...msg, sources: sources.length > 0 ? sources : undefined };
      }
      return msg;
    })
  );

  return Response.json({ conversation, messages: messagesWithSources });
}

// PUT /api/conversations/:id — update (rename, archive)
// DELETE /api/conversations/:id — delete
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

  if (request.method === "DELETE") {
    await repo.delete(params.id);
    return Response.json({ success: true });
  }

  if (request.method === "PUT") {
    const body = (await request.json()) as { title?: string; archived?: boolean };
    const updated = await repo.update(params.id, {
      title: body.title,
      archived: body.archived,
    });
    return Response.json({ conversation: updated });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
