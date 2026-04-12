import type { Conversation, Message } from "../entities/conversation";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByUserId(userId: string): Promise<Conversation[]>;
  create(userId: string, title?: string): Promise<Conversation>;
  update(id: string, data: Partial<Conversation>): Promise<Conversation>;
  delete(id: string): Promise<void>;
  addMessage(conversationId: string, role: Message["role"], content: string, tokensUsed?: number, model?: string): Promise<Message>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
}
