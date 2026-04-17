import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  onRegenerate?: () => void;
  disabled: boolean;
  isLoading?: boolean;
  canRegenerate?: boolean;
  leftSlot?: React.ReactNode;
}

export function ChatInput({
  onSend,
  onStop,
  onRegenerate,
  disabled,
  isLoading = false,
  canRegenerate = false,
  leftSlot,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  const charsRemaining = MAX_INPUT_LENGTH - value.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Regenerate button — shown when last message was from assistant and not loading */}
      {canRegenerate && !isLoading && onRegenerate && (
        <div className="mx-auto mb-2 flex max-w-3xl justify-center">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label={t("chat.regenerate")}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            {t("chat.regenerate")}
          </button>
        </div>
      )}

      <div className="mx-auto flex items-stretch max-w-3xl gap-3">
        {leftSlot}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={t("chat.inputPlaceholder")}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            maxLength={MAX_INPUT_LENGTH + 100}
          />
          {value.length > MAX_INPUT_LENGTH * 0.8 && (
            <span
              className={`absolute bottom-2 right-2 text-xs ${
                isOverLimit ? "text-red-500" : "text-gray-400"
              }`}
            >
              {charsRemaining}
            </span>
          )}
        </div>

        {/* Stop button while loading */}
        {isLoading && onStop ? (
          <button
            onClick={onStop}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label={t("chat.stop")}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !value.trim() || isOverLimit}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t("common.send")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
