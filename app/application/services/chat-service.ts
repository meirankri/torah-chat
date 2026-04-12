import type { ChatMessage } from "~/domain/entities/chat";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildLLMMessages(
  systemPrompt: string,
  history: ChatMessage[],
  maxHistoryMessages: number
): LLMMessage[] {
  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = history.slice(-maxHistoryMessages);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}
