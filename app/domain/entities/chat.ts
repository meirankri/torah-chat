import type { MessageRole } from "./conversation";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export type ChatErrorCode =
  | "TIMEOUT"
  | "API_DOWN"
  | "QUOTA_EXCEEDED"
  | "INPUT_TOO_LONG"
  | "RATE_LIMITED"
  | "UNKNOWN";

export interface ChatError {
  code: ChatErrorCode;
  message: string;
}

export interface SendMessageInput {
  content: string;
  conversationId?: string;
}

export const MAX_INPUT_LENGTH = 2000;
