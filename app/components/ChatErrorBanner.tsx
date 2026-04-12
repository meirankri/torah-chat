import type { ChatError } from "~/domain/entities/chat";

interface ChatErrorBannerProps {
  error: ChatError;
  onDismiss: () => void;
}

export function ChatErrorBanner({ error, onDismiss }: ChatErrorBannerProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-2">
      <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        <span>{error.message}</span>
        <button
          onClick={onDismiss}
          className="ml-3 shrink-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
          aria-label="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
