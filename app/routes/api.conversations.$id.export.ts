/**
 * GET /api/conversations/:id/export
 * Exports a conversation as a Markdown file for download.
 * Returns a text/markdown response with Content-Disposition: attachment.
 */
import type { Route } from "./+types/api.conversations.$id.export";
import { requireAuth } from "~/lib/auth/middleware";
import { D1ConversationRepository } from "~/infrastructure/repositories/d1-conversation-repository";

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

  // Build markdown content
  const title = conversation.title ?? "Conversation Torah Chat";
  const createdAt = new Date(conversation.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    `# ${title}`,
    ``,
    `*Exporté depuis Torah Chat — ${createdAt}*`,
    ``,
    `---`,
    ``,
  ];

  const messagesWithSources = await Promise.all(
    messages.map(async (msg) => {
      if (msg.role === "assistant") {
        const sources = await repo.getSourcesForMessage(msg.id);
        return { ...msg, sources: sources.length > 0 ? sources : undefined };
      }
      return msg;
    })
  );

  for (const msg of messagesWithSources) {
    if (msg.role === "user") {
      lines.push(`**Vous :** ${msg.content}`);
    } else {
      lines.push(`**Torah Chat :**`);
      lines.push(``);
      lines.push(msg.content);

      if (msg.sources && msg.sources.length > 0) {
        lines.push(``);
        lines.push(`*Sources :*`);
        for (const src of msg.sources) {
          const label = src.ref ?? src.title ?? "Source";
          if (src.sefariaUrl) {
            lines.push(`- [${label}](${src.sefariaUrl})`);
          } else {
            lines.push(`- ${label}`);
          }
        }
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  const markdown = lines.join("\n");

  // Sanitize filename
  const filename = title
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename || "conversation"}.md"`,
    },
  });
}
