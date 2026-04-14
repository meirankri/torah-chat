import { describe, it, expect, vi, beforeEach } from "vitest";
import { D1UserRepository } from "../d1-user-repository";

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

const baseUserRow = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  password_hash: null,
  provider: "email",
  provider_id: null,
  language: "fr",
  plan: "free_trial",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  questions_this_month: 5,
  questions_reset_at: null,
  trial_ends_at: null,
  failed_login_attempts: 0,
  locked_until: null,
  email_verified: 1,
  email_verification_token: null,
  password_reset_token: null,
  password_reset_expires_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("D1UserRepository", () => {
  let db: D1Database;
  let mockFirst: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = createMockDB();
    db = mocks.db;
    mockFirst = mocks.mockFirst;
    mockRun = mocks.mockRun;
  });

  it("findById retourne null si pas trouvé", async () => {
    mockFirst.mockResolvedValueOnce(null);
    const repo = new D1UserRepository(db);
    expect(await repo.findById("nonexistent")).toBeNull();
  });

  it("findById mappe correctement les colonnes", async () => {
    mockFirst.mockResolvedValueOnce(baseUserRow);
    const repo = new D1UserRepository(db);
    const user = await repo.findById("user-1");
    expect(user?.id).toBe("user-1");
    expect(user?.email).toBe("test@example.com");
    expect(user?.emailVerified).toBe(true);
    expect(user?.questionsThisMonth).toBe(5);
  });

  it("delete appelle DELETE sur la table users", async () => {
    mockRun.mockResolvedValueOnce({});
    const repo = new D1UserRepository(db);
    await repo.delete("user-1");
    expect(db.prepare).toHaveBeenCalledWith("DELETE FROM users WHERE id = ?");
    expect(mockRun).toHaveBeenCalled();
  });

  it("update(name) met à jour le nom", async () => {
    mockRun.mockResolvedValueOnce({});
    mockFirst.mockResolvedValueOnce({ ...baseUserRow, name: "Nouveau Nom" });
    const repo = new D1UserRepository(db);
    const updated = await repo.update("user-1", { name: "Nouveau Nom" });
    expect(updated.name).toBe("Nouveau Nom");
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET")
    );
  });

  it("update sans champs ne modifie rien et retourne l'utilisateur", async () => {
    mockFirst.mockResolvedValueOnce(baseUserRow);
    const repo = new D1UserRepository(db);
    const user = await repo.update("user-1", {});
    expect(user.name).toBe("Test User");
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("incrementQuestions incrémente le compteur", async () => {
    mockRun.mockResolvedValueOnce({});
    const repo = new D1UserRepository(db);
    await repo.incrementQuestions("user-1");
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("questions_this_month = questions_this_month + 1")
    );
  });
});
