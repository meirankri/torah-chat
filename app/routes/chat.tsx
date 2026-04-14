import type { Route } from "./+types/chat";
import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useChat } from "~/lib/use-chat";
import { useConversations } from "~/lib/use-conversations";
import { useAutoScroll } from "~/lib/use-auto-scroll";
import { ChatInput } from "~/components/ChatInput";
import { ChatMessage } from "~/components/ChatMessage";
import { TypingIndicator } from "~/components/TypingIndicator";
import { ChatErrorBanner } from "~/components/ChatErrorBanner";
import { ConversationSidebar } from "~/components/ConversationSidebar";
import { LanguageSelector } from "~/components/LanguageSelector";
import { requireAuth } from "~/lib/auth/middleware";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }
  await requireAuth(request, jwtSecret);
  return null;
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat" },
    { name: "description", content: "Ask your questions about the Torah" },
  ];
}

export default function Chat() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    conversations,
    activeConversationId,
    loadConversations,
    selectConversation,
    deleteConversation,
    renameConversation,
    setActiveConversationId,
    generateTitle,
  } = useConversations();

  const chatOptions = useMemo(
    () => ({
      conversationId: activeConversationId,
      onConversationCreated: (id: string) => {
        setActiveConversationId(id);
        loadConversations();
      },
      onFirstExchange: (id: string) => {
        generateTitle(id);
      },
    }),
    [activeConversationId, setActiveConversationId, loadConversations, generateTitle]
  );

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    clearMessages,
    setMessages,
  } = useChat(chatOptions);

  const lastMessageContent = messages[messages.length - 1]?.content ?? "";
  const { containerRef } = useAutoScroll(lastMessageContent);

  const showTyping =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.content === "";

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    clearMessages();
  }, [setActiveConversationId, clearMessages]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      const data = await selectConversation(id);
      if (data) {
        const chatMessages: ChatMessageType[] = data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          sources: m.sources?.map((s) => ({
            ...s,
            sourceType: s.sourceType as "sefaria" | "custom" | "hebrewbooks" | "unverified",
          })),
        }));
        setMessages(chatMessages);
      }
    },
    [selectConversation, setMessages]
  );

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label={t("chat.openMenu")}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("chat.title")}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSelector />
              <Link
                to="/profile"
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {t("nav.profile")}
              </Link>
            </div>
          </div>
        </header>

        {/* Error banner */}
        {error && <ChatErrorBanner error={error} onDismiss={clearError} />}

        {/* Messages area */}
        <div ref={containerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t("chat.title")}
                </h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {t("chat.emptyState")}
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
    </div>
  );
}
