import type { Route } from "./+types/share.$token";
import { useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { Suspense, lazy } from "react";
import { SourceBlock } from "~/components/SourceBlock";
import type { MessageSource } from "~/domain/entities/source";

const MarkdownRenderer = lazy(() =>
  import("~/components/MarkdownRenderer.client").then((m) => ({
    default: m.MarkdownRenderer,
  }))
);

interface SharedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: MessageSource[];
}

interface SharedConversation {
  title: string | null;
  messages: SharedMessage[];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const row = await env.DB.prepare(
    "SELECT conversation_id FROM shared_conversations WHERE token = ?"
  )
    .bind(params.token)
    .first<{ conversation_id: string }>();

  if (!row) {
    throw new Response("Not found", { status: 404 });
  }

  const conv = await env.DB.prepare(
    "SELECT title FROM conversations WHERE id = ?"
  )
    .bind(row.conversation_id)
    .first<{ title: string | null }>();

  if (!conv) {
    throw new Response("Not found", { status: 404 });
  }

  const { results: msgRows } = await env.DB.prepare(
    "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  )
    .bind(row.conversation_id)
    .all<{ id: string; role: string; content: string; created_at: string }>();

  const messages: SharedMessage[] = await Promise.all(
    msgRows.map(async (msg) => {
      if (msg.role === "assistant") {
        const { results: srcRows } = await env.DB.prepare(
          "SELECT * FROM message_sources WHERE message_id = ?"
        )
          .bind(msg.id)
          .all<{
            id: string;
            message_id: string;
            source_type: string;
            ref: string;
            title: string | null;
            text_hebrew: string | null;
            text_translation: string | null;
            translation_language: string | null;
            category: string | null;
            sefaria_url: string | null;
            created_at: string;
          }>();

        return {
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          createdAt: msg.created_at,
          sources:
            srcRows.length > 0
              ? srcRows.map((s) => ({
                  id: s.id,
                  messageId: s.message_id,
                  sourceType: s.source_type as MessageSource["sourceType"],
                  ref: s.ref,
                  title: s.title,
                  textHebrew: s.text_hebrew,
                  textTranslation: s.text_translation,
                  translationLanguage: s.translation_language,
                  category: s.category,
                  sefariaUrl: s.sefaria_url,
                  createdAt: s.created_at,
                }))
              : undefined,
        };
      }
      return {
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        createdAt: msg.created_at,
      };
    })
  );

  return {
    conversation: { title: conv.title, messages } satisfies SharedConversation,
  };
}

export function meta({ data }: Route.MetaArgs) {
  const title =
    (data as { conversation: SharedConversation } | undefined)?.conversation
      ?.title ?? "Torah Chat";
  return [
    { title: `${title} — Torah Chat` },
    {
      name: "description",
      content: "Conversation partagée depuis Torah Chat",
    },
  ];
}

export default function SharedConversationPage() {
  const { t } = useTranslation();
  const { conversation } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {conversation.title ?? t("sidebar.defaultTitle")}
          </h1>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Torah Chat
          </span>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
              }`}
            >
              {msg.role === "assistant" ? (
                <Suspense fallback={<p className="whitespace-pre-wrap text-sm">{msg.content}</p>}>
                  <MarkdownRenderer content={msg.content} />
                </Suspense>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.sources.map((src) => (
                    <SourceBlock key={src.id} source={src} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div className="pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("share.cta")}
          </p>
          <a
            href="/chat"
            className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t("share.startChat")}
          </a>
        </div>
      </main>
    </div>
  );
}
