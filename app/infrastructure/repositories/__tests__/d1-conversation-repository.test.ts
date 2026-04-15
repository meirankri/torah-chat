import { describe, it, expect, vi, beforeEach } from "vitest";
import { D1ConversationRepository } from "../d1-conversation-repository";

// Mock D1Database
function createMockDB() {
  const mockFirst = vi.fn();
  const mockAll = vi.fn();
  const mockRun = vi.fn();
  const mockBind = vi.fn();

  const stmt = {
    bind: mockBind.mockReturnThis(),
    first: mockFirst,
    all: mockAll,
    run: mockRun,
  };

  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as D1Database;

  return { db, mockFirst, mockAll, mockRun, mockBind };
}

describe("D1ConversationRepository", () => {
  let db: D1Database;
  let mockFirst: ReturnType<typeof vi.fn>;
  let mockAll: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = createMockDB();
    db = mocks.db;
    mockFirst = mocks.mockFirst;
    mockAll = mocks.mockAll;
    mockRun = mocks.mockRun;
  });

  it("findById retourne null si pas trouvé", async () => {
    mockFirst.mockResolvedValueOnce(null);
    const repo = new D1ConversationRepository(db);
    const result = await repo.findById("nonexistent");
    expect(result).toBeNull();
  });

  it("findById retourne une conversation mappée", async () => {
    mockFirst.mockResolvedValueOnce({
      id: "conv-1",
      user_id: "user-1",
      title: "Test conversation",
      archived: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.findById("conv-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("conv-1");
    expect(result?.userId).toBe("user-1");
    expect(result?.title).toBe("Test conversation");
    expect(result?.archived).toBe(false);
  });

  it("findByUserId retourne une liste de conversations", async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "conv-1",
          user_id: "user-1",
          title: "First",
          archived: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
        },
        {
          id: "conv-2",
          user_id: "user-1",
          title: "Second",
          archived: 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.findByUserId("user-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("conv-1");
    expect(result[1]?.id).toBe("conv-2");
  });

  it("create appelle INSERT et retourne la conversation", async () => {
    mockRun.mockResolvedValueOnce({});
    mockFirst.mockResolvedValueOnce({
      id: "new-id",
      user_id: "user-1",
      title: null,
      archived: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.create("user-1");

    expect(result.userId).toBe("user-1");
    expect(result.title).toBeNull();
    expect(mockRun).toHaveBeenCalled();
  });

  it("delete appelle DELETE", async () => {
    mockRun.mockResolvedValueOnce({});

    const repo = new D1ConversationRepository(db);
    await repo.delete("conv-1");

    expect(db.prepare).toHaveBeenCalledWith(
      "DELETE FROM conversations WHERE id = ?"
    );
  });

  it("getMessages retourne les messages ordonnés", async () => {
    mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "msg-1",
          conversation_id: "conv-1",
          role: "user",
          content: "Hello",
          tokens_used: null,
          model: null,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "msg-2",
          conversation_id: "conv-1",
          role: "assistant",
          content: "Shalom",
          tokens_used: 50,
          model: "gemini",
          created_at: "2024-01-01T00:00:01Z",
        },
      ],
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.getMessages("conv-1");

    expect(result).toHaveLength(2);
    expect(result[0]?.role).toBe("user");
    expect(result[0]?.content).toBe("Hello");
    expect(result[1]?.role).toBe("assistant");
    expect(result[1]?.content).toBe("Shalom");
  });

  it("addMessage insère et met à jour updated_at", async () => {
    mockRun.mockResolvedValue({});
    mockFirst.mockResolvedValueOnce({
      id: "msg-new",
      conversation_id: "conv-1",
      role: "user",
      content: "Question",
      tokens_used: null,
      model: null,
      created_at: "2024-01-01T00:00:00Z",
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.addMessage("conv-1", "user", "Question");

    expect(result.content).toBe("Question");
    expect(result.role).toBe("user");
    // Should have called INSERT for message and UPDATE for conversation updated_at
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it("update modifie le titre", async () => {
    mockRun.mockResolvedValueOnce({});
    mockFirst.mockResolvedValueOnce({
      id: "conv-1",
      user_id: "user-1",
      title: "New Title",
      archived: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:01Z",
    });

    const repo = new D1ConversationRepository(db);
    const result = await repo.update("conv-1", { title: "New Title" });

    expect(result.title).toBe("New Title");
  });

  it("saveFeedback appelle INSERT avec ON CONFLICT", async () => {
    mockRun.mockResolvedValueOnce({});

    const repo = new D1ConversationRepository(db);
    await repo.saveFeedback("msg-1", "user-1", 1);

    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO message_feedback")
    );
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT(message_id, user_id)")
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("saveFeedback accepte rating -1 (👎)", async () => {
    mockRun.mockResolvedValueOnce({});

    const repo = new D1ConversationRepository(db);
    await expect(repo.saveFeedback("msg-1", "user-1", -1)).resolves.toBeUndefined();
  });

  it("findArchivedByUserId retourne les conversations archivées", async () => {
    const archivedRow = {
      id: "conv-archived",
      user_id: "user-1",
      title: "Archived conversation",
      archived: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    mockAll.mockResolvedValueOnce({ results: [archivedRow] });

    const repo = new D1ConversationRepository(db);
    const result = await repo.findArchivedByUserId("user-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.archived).toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("archived = 1")
    );
  });

  it("findArchivedByUserId retourne un tableau vide si aucune conversation archivée", async () => {
    mockAll.mockResolvedValueOnce({ results: [] });

    const repo = new D1ConversationRepository(db);
    const result = await repo.findArchivedByUserId("user-1");
    expect(result).toEqual([]);
  });
});
