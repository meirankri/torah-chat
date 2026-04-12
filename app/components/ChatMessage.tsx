import { Suspense, lazy } from "react";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";
import { SourceBlock } from "./SourceBlock";

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer.client").then((m) => ({ default: m.MarkdownRenderer }))
);

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
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

        {/* Sources section (assistant messages only) */}
        {!isUser && message.sourcesLoading && (
          <div className="flex items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Recherche des sources...</span>
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
