import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, ChatError } from "~/domain/entities/chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { MessageSource } from "~/domain/entities/source";
import i18n from "~/i18n/config";

interface ChatApiResponse {
  response: string;
  sources: MessageSource[];
  sourcesError?: string;
  conversationId?: string;
  quotaInfo?: { used: number; limit: number | null };
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
  quotaInfo: { used: number; limit: number | null } | null;
  sendMessage: (content: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  stopGeneration: () => void;
  regenerateLastResponse: () => Promise<void>;
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
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; limit: number | null } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const exchangeCountRef = useRef(0);
  // Keep a ref to the last user message for regeneration
  const lastUserContentRef = useRef<string | null>(null);

  // Sync conversationId from options when it changes externally
  useEffect(() => {
    setConversationId(options.conversationId ?? null);
  }, [options.conversationId]);

  const clearError = useCallback(() => setError(null), []);
  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    exchangeCountRef.current = 0;
    lastUserContentRef.current = null;
  }, []);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
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

    lastUserContentRef.current = trimmed;
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
        // Translate error message by code when possible
        const t = i18n.t.bind(i18n);
        const translatedMessage = (() => {
          switch (errorData.code) {
            case "API_DOWN": return t("errors.apiDown");
            case "QUOTA_EXCEEDED": return t("errors.quotaExceeded");
            case "RATE_LIMITED": return t("errors.rateLimited");
            case "INPUT_TOO_LONG": return t("errors.inputTooLong", { max: MAX_INPUT_LENGTH });
            default: return errorData.message;
          }
        })();
        setError({
          code: errorData.code as ChatError["code"],
          message: translatedMessage,
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

      // Update quota info
      if (data.quotaInfo) {
        setQuotaInfo(data.quotaInfo);
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
        // Remove the empty assistant message on stop
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
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

  const regenerateLastResponse = useCallback(async () => {
    const lastUserContent = lastUserContentRef.current;
    if (!lastUserContent || isLoading) return;

    // Remove the last assistant message (and possibly its user message for a fresh retry)
    setMessages((prev) => {
      const lastAssistantIdx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (lastAssistantIdx === -1) return prev;
      const realIdx = prev.length - 1 - lastAssistantIdx;
      return prev.slice(0, realIdx);
    });

    await sendMessage(lastUserContent);
  }, [isLoading, sendMessage]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (isLoading) return;

    // Delete messages from this message onward on the server
    if (conversationId) {
      try {
        await fetch(`/api/conversations/${conversationId}/edit-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        });
      } catch {
        // Continue even if server call fails — we'll still update locally
      }
    }

    // Remove the target message and everything after it locally
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });

    // Send the edited content as a new message
    await sendMessage(newContent);
  }, [isLoading, conversationId, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    quotaInfo,
    sendMessage,
    editMessage,
    stopGeneration,
    regenerateLastResponse,
    clearError,
    clearMessages,
    setMessages,
  };
}
