import type { Route } from "./+types/chat";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
import { PwaInstallBanner } from "~/components/PwaInstallBanner";
import { QuotaWarningBanner } from "~/components/QuotaWarningBanner";
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
  const navigate = useNavigate();
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    conversations,
    archivedConversations,
    activeConversationId,
    loadConversations,
    selectConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    setActiveConversationId,
    generateTitle,
  } = useConversations();

  // Sync URL param → active conversation on mount / URL change
  useEffect(() => {
    if (urlConversationId && urlConversationId !== activeConversationId) {
      setActiveConversationId(urlConversationId);
    } else if (!urlConversationId && activeConversationId) {
      setActiveConversationId(null);
    }
    // Only run when URL param changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId]);

  const chatOptions = useMemo(
    () => ({
      conversationId: activeConversationId,
      onConversationCreated: (id: string) => {
        setActiveConversationId(id);
        loadConversations();
        navigate(`/chat/${id}`, { replace: true });
      },
      onFirstExchange: (id: string) => {
        generateTitle(id);
      },
    }),
    [activeConversationId, setActiveConversationId, loadConversations, generateTitle, navigate]
  );

  const {
    messages,
    isLoading,
    error,
    quotaInfo,
    sendMessage,
    editMessage,
    stopGeneration,
    regenerateLastResponse,
    clearError,
    clearMessages,
    setMessages,
  } = useChat(chatOptions);

  const handleFeedback = useCallback(async (messageId: string, rating: 1 | -1) => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating }),
      });
    } catch {
      // non-blocking
    }
  }, []);

  const lastMessageContent = messages[messages.length - 1]?.content ?? "";
  const { containerRef } = useAutoScroll(lastMessageContent);

  const showTyping =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    messages[messages.length - 1]?.content === "";

  // Can regenerate if last message is a non-empty assistant message
  const canRegenerate =
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant" &&
    (messages[messages.length - 1]?.content?.length ?? 0) > 0;

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    clearMessages();
    navigate("/chat");
  }, [setActiveConversationId, clearMessages, navigate]);

  const loadConversationMessages = useCallback(
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
      return data;
    },
    [selectConversation, setMessages]
  );

  const handleSelectConversation = useCallback(
    async (id: string) => {
      await loadConversationMessages(id);
      navigate(`/chat/${id}`);
    },
    [loadConversationMessages, navigate]
  );

  // Load conversation from URL on mount
  useEffect(() => {
    if (urlConversationId && messages.length === 0) {
      loadConversationMessages(urlConversationId);
    }
    // Only on mount / URL change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId]);

  // Suggested questions — translated
  const suggestedQuestions: string[] = t("chat.suggestedQuestions", { returnObjects: true }) as string[];

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        archivedConversations={archivedConversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={async (id: string) => {
          await deleteConversation(id);
          if (activeConversationId === id) {
            navigate("/chat");
          }
        }}
        onRenameConversation={renameConversation}
        onArchiveConversation={async (id: string, archived: boolean) => {
          await archiveConversation(id, archived);
          if (archived && activeConversationId === id) {
            navigate("/chat");
          }
        }}
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

        {/* Quota warning banner (at 80%+ usage) */}
        {quotaInfo && quotaInfo.limit !== null && (
          <QuotaWarningBanner used={quotaInfo.used} limit={quotaInfo.limit} />
        )}

        {/* Messages area */}
        <div ref={containerRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t("chat.title")}
                </h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {t("chat.emptyState")}
                </p>

                {/* Suggested questions */}
                {Array.isArray(suggestedQuestions) && suggestedQuestions.length > 0 && (
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        onClick={() => sendMessage(question)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onFeedback={msg.role === "assistant" ? handleFeedback : undefined}
                onEdit={msg.role === "user" ? editMessage : undefined}
              />
            ))}

            {showTyping && <TypingIndicator />}
          </div>
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          onStop={stopGeneration}
          onRegenerate={regenerateLastResponse}
          disabled={isLoading}
          isLoading={isLoading}
          canRegenerate={canRegenerate}
        />
      </div>

      {/* PWA install banner */}
      <PwaInstallBanner />
    </div>
  );
}
