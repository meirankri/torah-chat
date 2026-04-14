import { Suspense, lazy, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";
import { SourceBlock } from "./SourceBlock";

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer.client").then((m) => ({ default: m.MarkdownRenderer }))
);

interface ChatMessageProps {
  message: ChatMessageType;
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors dark:hover:bg-gray-700 dark:hover:text-gray-300"
      title={copied ? t("chat.copied") : t("chat.copy")}
      aria-label={t("chat.copy")}
    >
      {copied ? (
        <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
        </svg>
      )}
    </button>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[80%] ${isUser ? "" : "space-y-3"}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
              <MarkdownRenderer content={message.content} />
            </Suspense>
          )}
        </div>

        {/* Copy button for assistant messages with content */}
        {!isUser && message.content && (
          <div className="flex items-center gap-1 px-1">
            <CopyButton text={message.content} />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t("chat.copy")}
            </span>
          </div>
        )}

        {/* Sources section (assistant messages only) */}
        {!isUser && message.sourcesLoading && (
          <div className="flex items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{t("chat.searchingSources")}</span>
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="space-y-2">
            {message.sources.map((source) => (
              <SourceBlock key={source.id} source={source} />
            ))}
          </div>
        )}

        {!isUser && message.sourcesError && (
          <p className="px-1 text-sm text-gray-500 dark:text-gray-400">
            {message.sourcesError}
          </p>
        )}
      </div>
    </div>
  );
}
