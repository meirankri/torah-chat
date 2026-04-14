import { describe, it, expect, vi, beforeEach } from "vitest";
import { signup, login } from "~/application/services/auth-service";
import type { AuthDeps } from "~/application/services/auth-service";
import type { User } from "~/domain/entities/user";
import type { RefreshToken } from "~/domain/entities/auth";
import type { UserRepository } from "~/domain/repositories/user-repository";
import type { RefreshTokenRepository } from "~/domain/repositories/refresh-token-repository";

const TEST_SECRET = "test-secret-key-at-least-32-chars-long";

describe("Auth brute force protection", () => {
  let users: Map<string, User>;
  let refreshTokens_: Map<string, RefreshToken>;
  let deps: AuthDeps;

  beforeEach(() => {
    users = new Map();
    refreshTokens_ = new Map();

    const userRepo: UserRepository = {
      findById: vi.fn(async (id) => users.get(id) ?? null),
      findByEmail: vi.fn(async (email) => {
        for (const user of users.values()) {
          if (user.email === email) return user;
        }
        return null;
      }),
      findByProvider: vi.fn(async () => null),
      create: vi.fn(async (input) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const user: User = {
          id,
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash ?? null,
          provider: input.provider,
          providerId: input.providerId ?? null,
          language: input.language,
          plan: "free_trial",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          questionsThisMonth: 0,
          questionsResetAt: null,
          trialEndsAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          emailVerified: false,
          emailVerificationToken: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          createdAt: now,
          updatedAt: now,
        };
        users.set(id, user);
        return user;
      }),
      update: vi.fn(async (id, data) => {
        const user = users.get(id);
        if (!user) throw new Error("User not found");
        const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
        users.set(id, updated);
        return updated;
      }),
      incrementQuestions: vi.fn(),
      resetMonthlyQuestions: vi.fn(),
      findByStripeCustomerId: vi.fn().mockResolvedValue(null),
      findUsersWithTrialEndingOn: vi.fn().mockResolvedValue([]),
    };

    const refreshTokenRepo: RefreshTokenRepository = {
      create: vi.fn(async (input) => {
        const token: RefreshToken = {
          id: crypto.randomUUID(),
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt: new Date().toISOString(),
        };
        refreshTokens_.set(token.tokenHash, token);
        return token;
      }),
      findByTokenHash: vi.fn(async (hash) => refreshTokens_.get(hash) ?? null),
      deleteByUserId: vi.fn(async (userId) => {
        for (const [hash, token] of refreshTokens_.entries()) {
          if (token.userId === userId) refreshTokens_.delete(hash);
        }
      }),
      deleteExpired: vi.fn(),
    };

    deps = { userRepo, refreshTokenRepo, jwtSecret: TEST_SECRET };
  });

  it("verrouille le compte après 5 tentatives échouées", async () => {
    // Create a user first
    await signup(
      { name: "Test User", email: "test@example.com", password: "Password1" },
      deps
    );

    // Attempt 5 wrong logins
    for (let i = 0; i < 5; i++) {
      await expect(
        login({ email: "test@example.com", password: "WrongPassword1" }, deps)
      ).rejects.toThrow("Email ou mot de passe incorrect");
    }

    // The user should now be locked
    const lockedUser = Array.from(users.values())[0];
    expect(lockedUser?.lockedUntil).toBeTruthy();
    expect(lockedUser?.failedLoginAttempts).toBe(5);

    // Even with the right password, should be locked
    await expect(
      login({ email: "test@example.com", password: "Password1" }, deps)
    ).rejects.toThrow("Compte temporairement verrouillé");
  });
});
