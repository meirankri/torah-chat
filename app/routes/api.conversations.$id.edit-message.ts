import type { Route } from "./+types/api.conversations.$id.edit-message";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

interface EditMessageBody {
  messageId: string;
}

// POST /api/conversations/:id/edit-message
// Deletes the target message and all subsequent messages in the conversation
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

  const body = (await request.json()) as EditMessageBody;

  if (!body.messageId) {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }

  await repo.deleteMessagesFromId(params.id, body.messageId);

  return Response.json({ success: true });
}
