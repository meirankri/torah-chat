import type { Route } from "./+types/api.conversations";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

// GET /api/conversations — list user's conversations
export async function loader({ request, context }: Route.LoaderArgs) {
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
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("archived") === "true";

  const conversations = await repo.findByUserId(userId);
  if (includeArchived) {
    const archived = await repo.findArchivedByUserId(userId);
    return Response.json({ conversations, archived });
  }

  return Response.json({ conversations });
}

// POST /api/conversations — create a new conversation
export async function action({ request, context }: Route.ActionArgs) {
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
  const conversation = await repo.create(userId);

  return Response.json({ conversation }, { status: 201 });
}
