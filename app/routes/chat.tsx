import type { Route } from "./+types/chat";
import { Link } from "react-router";
import { useChat } from "~/lib/use-chat";
import { useAutoScroll } from "~/lib/use-auto-scroll";
import { ChatInput } from "~/components/ChatInput";
import { ChatMessage } from "~/components/ChatMessage";
import { TypingIndicator } from "~/components/TypingIndicator";
import { ChatErrorBanner } from "~/components/ChatErrorBanner";
import { requireAuth } from "~/lib/auth/middleware";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    // Auth not configured — allow access (dev mode)
    return null;
  }
  await requireAuth(request, jwtSecret);
  return null;
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat" },
    { name: "description", content: "Posez vos questions sur la Torah" },
  ];
}

export default function Chat() {
  const { messages, isLoading, error, sendMessage, clearError } = useChat();
  const lastMessageContent = messages[messages.length - 1]?.content ?? "";
  const { containerRef } = useAutoScroll(lastMessageContent);

  const showTyping =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.content === "";

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Torah Chat
          </h1>
          <Link
            to="/profile"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Mon profil
          </Link>
        </div>
      </header>

      {/* Error banner */}
      {error && <ChatErrorBanner error={error} onDismiss={clearError} />}

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Torah Chat
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Posez votre question sur la Torah, le Talmud, la Halakha...
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {showTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
