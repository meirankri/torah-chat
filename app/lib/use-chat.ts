import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ChatError } from "~/domain/entities/chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { MessageSource } from "~/domain/entities/source";

interface ChatApiResponse {
  response: string;
  sources: MessageSource[];
  sourcesError?: string;
  conversationId?: string;
}

interface UseChatOptions {
  conversationId?: string | null;
  onConversationCreated?: (conversationId: string) => void;
  onFirstExchange?: (conversationId: string) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ChatError | null;
  conversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
  setMessages: (messages: ChatMessage[]) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId ?? null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const exchangeCountRef = useRef(0);

  const clearError = useCallback(() => setError(null), []);
  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    exchangeCountRef.current = 0;
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_INPUT_LENGTH) {
      setError({
        code: "INPUT_TOO_LONG",
        message: `Le message est trop long. Maximum ${MAX_INPUT_LENGTH} caractères.`,
      });
      return;
    }

    setError(null);
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      sourcesLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          conversationId,
          history: messages,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json() as { code: string; message: string };
        setError({
          code: errorData.code as ChatError["code"],
          message: errorData.message,
        });
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
        setIsLoading(false);
        return;
      }

      const data = await response.json() as ChatApiResponse;

      // Track conversation ID from backend
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        options.onConversationCreated?.(data.conversationId);
      }

      const sources: MessageSource[] = (data.sources ?? []).map((s) => ({
        ...s,
        messageId: assistantMessageId,
      }));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: data.response,
                sources: sources.length > 0 ? sources : undefined,
                sourcesLoading: false,
                sourcesError: data.sourcesError,
              }
            : m
        )
      );

      // Trigger title generation after first exchange
      exchangeCountRef.current += 1;
      if (exchangeCountRef.current === 1) {
        const cid = data.conversationId ?? conversationId;
        if (cid) {
          options.onFirstExchange?.(cid);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError({
        code: "UNKNOWN",
        message: "Une erreur inattendue est survenue. Veuillez réessayer.",
      });
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, conversationId, options]);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    clearError,
    clearMessages,
    setMessages,
  };
}
