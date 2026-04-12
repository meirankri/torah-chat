import { describe, it, expect } from "vitest";
import { MAX_INPUT_LENGTH } from "../chat";
import type { ChatMessage, ChatError, ChatErrorCode, SendMessageInput } from "../chat";

describe("Chat entities", () => {
  it("MAX_INPUT_LENGTH is 2000", () => {
    expect(MAX_INPUT_LENGTH).toBe(2000);
  });

  it("ChatMessage can be constructed with valid data", () => {
    const msg: ChatMessage = {
      id: "1",
      role: "user",
      content: "Hello",
      createdAt: new Date().toISOString(),
    };
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello");
  });

  it("ChatMessage supports assistant role", () => {
    const msg: ChatMessage = {
      id: "2",
      role: "assistant",
      content: "Response",
      createdAt: new Date().toISOString(),
    };
    expect(msg.role).toBe("assistant");
  });

  it("ChatError covers all error codes", () => {
    const codes: ChatErrorCode[] = [
      "TIMEOUT",
      "API_DOWN",
      "QUOTA_EXCEEDED",
      "INPUT_TOO_LONG",
      "RATE_LIMITED",
      "UNKNOWN",
    ];
    for (const code of codes) {
      const error: ChatError = { code, message: `Error: ${code}` };
      expect(error.code).toBe(code);
    }
  });

  it("SendMessageInput accepts optional conversationId", () => {
    const input1: SendMessageInput = { content: "test" };
    expect(input1.conversationId).toBeUndefined();

    const input2: SendMessageInput = { content: "test", conversationId: "conv-1" };
    expect(input2.conversationId).toBe("conv-1");
  });
});
