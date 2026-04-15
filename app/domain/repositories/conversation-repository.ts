import type { Conversation, Message } from "../entities/conversation";
import type { MessageSource } from "../entities/source";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByUserId(userId: string): Promise<Conversation[]>;
  findArchivedByUserId(userId: string): Promise<Conversation[]>;
  create(userId: string, title?: string): Promise<Conversation>;
  update(id: string, data: Partial<Conversation>): Promise<Conversation>;
  delete(id: string): Promise<void>;
  addMessage(conversationId: string, role: Message["role"], content: string, tokensUsed?: number, model?: string): Promise<Message>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  addSources(sources: MessageSource[]): Promise<void>;
  getSourcesForMessage(messageId: string): Promise<MessageSource[]>;
  saveFeedback(messageId: string, userId: string, rating: 1 | -1): Promise<void>;
}
