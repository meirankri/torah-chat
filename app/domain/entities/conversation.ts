export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  tokensUsed: number | null;
  model: string | null;
  createdAt: string;
}
