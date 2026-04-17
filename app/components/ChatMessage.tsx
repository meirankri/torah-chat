import { Suspense, lazy, useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";
import { SourceBlock } from "./SourceBlock";

type FeedbackRating = 1 | -1 | null;

const MarkdownRenderer = lazy(() =>
  import("./MarkdownRenderer.client").then((m) => ({ default: m.MarkdownRenderer }))
);

interface ChatMessageProps {
  message: ChatMessageType;
  onFeedback?: (messageId: string, rating: 1 | -1) => Promise<void>;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
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

function FeedbackButtons({
  messageId,
  onFeedback,
}: {
  messageId: string;
  onFeedback: (messageId: string, rating: 1 | -1) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState<FeedbackRating>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedback = useCallback(
    async (value: 1 | -1) => {
      if (submitting) return;
      const newRating = rating === value ? null : value;
      setRating(newRating);
      if (newRating !== null) {
        setSubmitting(true);
        try {
          await onFeedback(messageId, newRating);
        } catch {
          // non-blocking
        } finally {
          setSubmitting(false);
        }
      }
    },
    [messageId, onFeedback, rating, submitting]
  );

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback(1)}
        disabled={submitting}
        className={`rounded p-1 transition-colors ${
          rating === 1
            ? "text-green-500"
            : "text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        }`}
        title={t("chat.feedbackHelpful")}
        aria-label={t("chat.feedbackHelpful")}
        aria-pressed={rating === 1}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 0 1-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 0 1-1.341 5.974C17.153 16.323 16.072 17 14.9 17H8c-.943 0-1.836-.383-2.495-1.06l-.014-.015A9.916 9.916 0 0 1 4 9.572V8.25a1.75 1.75 0 0 1 1.75-1.75H9.5a.75.75 0 0 0 .75-.75V3z" />
        </svg>
      </button>
      <button
        onClick={() => handleFeedback(-1)}
        disabled={submitting}
        className={`rounded p-1 transition-colors ${
          rating === -1
            ? "text-red-500"
            : "text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        }`}
        title={t("chat.feedbackNotHelpful")}
        aria-label={t("chat.feedbackNotHelpful")}
        aria-pressed={rating === -1}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 0 1 2.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 5.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247a23.864 23.864 0 0 1 1.341-5.974C2.752 3.678 3.833 3 5.005 3h6.9c.943 0 1.836.383 2.495 1.06l.014.015A9.914 9.914 0 0 1 15.905 10.428v1.322a1.75 1.75 0 0 1-1.75 1.75H10.405a.75.75 0 0 0-.75.75V17z" />
        </svg>
      </button>
    </div>
  );
}

export function ChatMessage({ message, onFeedback, onEdit }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleEditSubmit = useCallback(() => {
    const trimmed = editContent.trim();
    if (!trimmed || !onEdit) return;
    setIsEditing(false);
    onEdit(message.id, trimmed);
  }, [editContent, onEdit, message.id]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    } else if (e.key === "Escape") {
      handleEditCancel();
    }
  }, [handleEditSubmit, handleEditCancel]);

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
          {isUser && isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={editTextareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full resize-none rounded-lg bg-blue-700 p-2 text-white placeholder-blue-300 outline-none"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleEditCancel}
                  className="rounded px-3 py-1 text-xs text-blue-200 hover:text-white"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleEditSubmit}
                  disabled={!editContent.trim()}
                  className="rounded bg-white px-3 py-1 text-xs font-medium text-blue-600 disabled:opacity-50"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
              <MarkdownRenderer content={message.content} />
            </Suspense>
          )}
        </div>

        {/* Edit button for user messages */}
        {isUser && !isEditing && onEdit && (
          <div className="flex justify-end px-1">
            <button
              onClick={() => {
                setEditContent(message.content);
                setIsEditing(true);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={t("chat.edit")}
              aria-label={t("chat.edit")}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          </div>
        )}

        {/* Action buttons for assistant messages with content */}
        {!isUser && message.content && (
          <div className="flex items-center gap-2 px-1">
            <CopyButton text={message.content} />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {t("chat.copy")}
            </span>
            {onFeedback && (
              <>
                <span className="text-gray-200 dark:text-gray-700">|</span>
                <FeedbackButtons messageId={message.id} onFeedback={onFeedback} />
              </>
            )}
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
