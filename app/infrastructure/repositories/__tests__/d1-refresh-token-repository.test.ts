import { describe, it, expect, vi, beforeEach } from "vitest";
import { D1RefreshTokenRepository } from "../d1-refresh-token-repository";

function createMockDB() {
  const mockFirst = vi.fn();
  const mockRun = vi.fn();
  const mockBind = vi.fn();

  const stmt = {
    bind: mockBind.mockReturnThis(),
    first: mockFirst,
    run: mockRun,
  };

  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  } as unknown as D1Database;

  return { db, mockFirst, mockRun, mockBind };
}

describe("D1RefreshTokenRepository", () => {
  let db: D1Database;
  let mockFirst: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = createMockDB();
    db = mocks.db;
    mockFirst = mocks.mockFirst;
    mockRun = mocks.mockRun;
  });

  describe("create", () => {
    it("insère un refresh token et retourne l'entité", async () => {
      mockRun.mockResolvedValueOnce({});
      const repo = new D1RefreshTokenRepository(db);

      const result = await repo.create({
        userId: "user-1",
        tokenHash: "hash-abc",
        expiresAt: "2026-01-01T00:00:00Z",
      });

      expect(result.userId).toBe("user-1");
      expect(result.tokenHash).toBe("hash-abc");
      expect(result.expiresAt).toBe("2026-01-01T00:00:00Z");
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO refresh_tokens")
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("findByTokenHash", () => {
    it("retourne null si le token n'existe pas", async () => {
      mockFirst.mockResolvedValueOnce(null);
      const repo = new D1RefreshTokenRepository(db);

      const result = await repo.findByTokenHash("nonexistent-hash");
      expect(result).toBeNull();
    });

    it("retourne le refresh token mappé si trouvé", async () => {
      mockFirst.mockResolvedValueOnce({
        id: "rt-1",
        user_id: "user-2",
        token_hash: "hash-xyz",
        expires_at: "2026-06-01T00:00:00Z",
        created_at: "2025-01-01T00:00:00Z",
      });
      const repo = new D1RefreshTokenRepository(db);

      const result = await repo.findByTokenHash("hash-xyz");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("rt-1");
      expect(result?.userId).toBe("user-2");
      expect(result?.tokenHash).toBe("hash-xyz");
      expect(result?.expiresAt).toBe("2026-06-01T00:00:00Z");
    });
  });

  describe("deleteByUserId", () => {
    it("supprime les tokens d'un utilisateur", async () => {
      mockRun.mockResolvedValueOnce({});
      const repo = new D1RefreshTokenRepository(db);

      await repo.deleteByUserId("user-3");

      expect(db.prepare).toHaveBeenCalledWith(
        "DELETE FROM refresh_tokens WHERE user_id = ?"
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("deleteExpired", () => {
    it("supprime les tokens expirés", async () => {
      mockRun.mockResolvedValueOnce({});
      const repo = new D1RefreshTokenRepository(db);

      await repo.deleteExpired();

      expect(db.prepare).toHaveBeenCalledWith(
        "DELETE FROM refresh_tokens WHERE expires_at < ?"
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });
});
