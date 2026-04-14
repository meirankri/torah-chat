import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useConversations } from "../use-conversations";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockConversations = [
  {
    id: "conv-1",
    userId: "user-1",
    title: "Torah question",
    archived: false,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
  {
    id: "conv-2",
    userId: "user-1",
    title: "Talmud discussion",
    archived: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

describe("useConversations", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Default: loadConversations on mount
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ conversations: mockConversations }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("charge les conversations au montage", async () => {
    const { result } = renderHook(() => useConversations());

    // Wait for useEffect to complete
    await act(async () => {});

    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.conversations[0]?.id).toBe("conv-1");
  });

  it("crée une nouvelle conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {});

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          conversation: {
            id: "conv-new",
            userId: "user-1",
            title: null,
            archived: false,
            createdAt: "2024-01-03T00:00:00Z",
            updatedAt: "2024-01-03T00:00:00Z",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    );

    let newId: string = "";
    await act(async () => {
      newId = await result.current.createConversation();
    });

    expect(newId).toBe("conv-new");
    expect(result.current.activeConversationId).toBe("conv-new");
    expect(result.current.conversations).toHaveLength(3);
  });

  it("supprime une conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {});

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );

    await act(async () => {
      await result.current.deleteConversation("conv-1");
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]?.id).toBe("conv-2");
  });

  it("renomme une conversation", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {});

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          conversation: { ...mockConversations[0], title: "New Title" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await act(async () => {
      await result.current.renameConversation("conv-1", "New Title");
    });

    expect(result.current.conversations[0]?.title).toBe("New Title");
  });

  it("sélectionne une conversation et charge ses messages", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {});

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          conversation: mockConversations[0],
          messages: [
            {
              id: "msg-1",
              conversationId: "conv-1",
              role: "user",
              content: "Hello",
              tokensUsed: null,
              model: null,
              createdAt: "2024-01-02T00:00:00Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    let data: Awaited<ReturnType<typeof result.current.selectConversation>>;
    await act(async () => {
      data = await result.current.selectConversation("conv-1");
    });

    expect(result.current.activeConversationId).toBe("conv-1");
    expect(data!).not.toBeNull();
    expect(data!.messages).toHaveLength(1);
  });

  it("setActiveConversationId change l'ID actif", async () => {
    const { result } = renderHook(() => useConversations());
    await act(async () => {});

    act(() => {
      result.current.setActiveConversationId("conv-2");
    });

    expect(result.current.activeConversationId).toBe("conv-2");

    act(() => {
      result.current.setActiveConversationId(null);
    });

    expect(result.current.activeConversationId).toBeNull();
  });
});
