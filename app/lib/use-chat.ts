import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ChatError } from "~/domain/entities/chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: ChatError | null;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearMessages = useCallback(() => setMessages([]), []);

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

    // Add user message
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
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    // Cancel any existing request
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
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
        // Remove the empty assistant message
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError({ code: "API_DOWN", message: "No response stream available." });
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Workers AI streaming format: "data: {json}\n\n" or raw text
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { response?: string };
              if (parsed.response) {
                fullContent += parsed.response;
              }
            } catch {
              // Not JSON, treat as raw text
              fullContent += data;
            }
          } else if (line.trim() && !line.startsWith(":")) {
            // Raw text chunk (some Workers AI models)
            fullContent += line;
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: fullContent } : m
          )
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request was cancelled, not an error
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
  }, [messages]);

  return { messages, isLoading, error, sendMessage, clearError, clearMessages };
}
