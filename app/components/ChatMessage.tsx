import { Suspense, lazy } from "react";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";

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
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
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
    </div>
  );
}
