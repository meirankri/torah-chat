import { describe, it, expect } from "vitest";
import type { Conversation, Message, MessageRole } from "../conversation";

describe("Conversation entity types", () => {
  it("Conversation entity se construit correctement", () => {
    const conversation: Conversation = {
      id: "conv_123",
      userId: "usr_456",
      title: null,
      archived: false,
      createdAt: "2025-01-07T00:00:00Z",
      updatedAt: "2025-01-07T00:00:00Z",
    };
    expect(conversation.archived).toBe(false);
    expect(conversation.title).toBeNull();
  });

  it("Message entity se construit correctement", () => {
    const message: Message = {
      id: "msg_789",
      conversationId: "conv_123",
      role: "user",
      content: "Que dit la Torah sur le respect des parents ?",
      tokensUsed: null,
      model: null,
      createdAt: "2025-01-07T00:00:00Z",
    };
    expect(message.role).toBe("user");
  });

  it("MessageRole couvre user et assistant", () => {
    const roles: MessageRole[] = ["user", "assistant"];
    expect(roles).toHaveLength(2);
  });
});
