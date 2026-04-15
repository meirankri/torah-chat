import { useState, useCallback, useEffect } from "react";
import type { Conversation } from "~/domain/entities/conversation";

interface ConversationsApiResponse {
  conversations: Conversation[];
  archived?: Conversation[];
}

interface ConversationDetailResponse {
  conversation: Conversation;
  messages: {
    id: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
    tokensUsed: number | null;
    model: string | null;
    createdAt: string;
    sources?: {
      id: string;
      messageId: string;
      sourceType: string;
      ref: string;
      title: string | null;
      textHebrew: string | null;
      textTranslation: string | null;
      translationLanguage: string | null;
      category: string | null;
      sefariaUrl: string | null;
      createdAt: string;
    }[];
  }[];
}

interface UseConversationsReturn {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  activeConversationId: string | null;
  isLoadingList: boolean;
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<ConversationDetailResponse | null>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  archiveConversation: (id: string, archived: boolean) => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
  generateTitle: (conversationId: string) => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const loadConversations = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch("/api/conversations?archived=true");
      if (response.ok) {
        const data = (await response.json()) as ConversationsApiResponse;
        setConversations(data.conversations);
        setArchivedConversations(data.archived ?? []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const createConversation = useCallback(async (): Promise<string> => {
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json()) as { conversation: Conversation };
    setConversations((prev) => [data.conversation, ...prev]);
    setActiveConversationId(data.conversation.id);
    return data.conversation.id;
  }, []);

  const selectConversation = useCallback(
    async (id: string): Promise<ConversationDetailResponse | null> => {
      setActiveConversationId(id);
      try {
        const response = await fetch(`/api/conversations/${id}`);
        if (!response.ok) return null;
        return (await response.json()) as ConversationDetailResponse;
      } catch {
        return null;
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
    [activeConversationId]
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    const response = await fetch(`/api/conversations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (response.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    }
  }, []);

  const archiveConversation = useCallback(
    async (id: string, archived: boolean) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (response.ok) {
        if (archived) {
          // Move from active to archived list
          setConversations((prev) => {
            const conv = prev.find((c) => c.id === id);
            if (conv) {
              setArchivedConversations((arc) => [{ ...conv, archived: true }, ...arc]);
            }
            return prev.filter((c) => c.id !== id);
          });
          if (activeConversationId === id) {
            setActiveConversationId(null);
          }
        } else {
          // Move from archived to active list
          setArchivedConversations((prev) => {
            const conv = prev.find((c) => c.id === id);
            if (conv) {
              setConversations((active) => [{ ...conv, archived: false }, ...active]);
            }
            return prev.filter((c) => c.id !== id);
          });
        }
      }
    },
    [activeConversationId]
  );

  const generateTitle = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/title`, {
        method: "POST",
      });
      if (response.ok) {
        const data = (await response.json()) as { title: string };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, title: data.title } : c
          )
        );
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    archivedConversations,
    activeConversationId,
    isLoadingList,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    setActiveConversationId,
    generateTitle,
  };
}
