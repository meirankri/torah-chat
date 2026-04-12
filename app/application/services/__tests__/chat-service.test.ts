import { describe, it, expect } from "vitest";
import { buildLLMMessages } from "../chat-service";
import type { ChatMessage } from "~/domain/entities/chat";

describe("buildLLMMessages", () => {
  const systemPrompt = "Tu es un assistant Torah.";

  it("returns system prompt as first message with empty history", () => {
    const result = buildLLMMessages(systemPrompt, [], 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "system", content: systemPrompt });
  });

  it("includes history messages after system prompt", () => {
    const history: ChatMessage[] = [
      { id: "1", role: "user", content: "Shalom", createdAt: "2024-01-01T00:00:00Z" },
      { id: "2", role: "assistant", content: "Shalom!", createdAt: "2024-01-01T00:00:01Z" },
    ];
    const result = buildLLMMessages(systemPrompt, history, 10);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ role: "user", content: "Shalom" });
    expect(result[2]).toEqual({ role: "assistant", content: "Shalom!" });
  });

  it("limits history to maxHistoryMessages", () => {
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i}`,
      createdAt: new Date(2024, 0, 1, 0, 0, i).toISOString(),
    }));

    const result = buildLLMMessages(systemPrompt, history, 6);
    // 1 system + 6 history
    expect(result).toHaveLength(7);
    // Should include last 6 messages (indices 14-19)
    expect(result[1]?.content).toBe("Message 14");
    expect(result[6]?.content).toBe("Message 19");
  });

  it("handles maxHistoryMessages larger than history", () => {
    const history: ChatMessage[] = [
      { id: "1", role: "user", content: "Hello", createdAt: "2024-01-01T00:00:00Z" },
    ];
    const result = buildLLMMessages(systemPrompt, history, 100);
    expect(result).toHaveLength(2);
  });
});
