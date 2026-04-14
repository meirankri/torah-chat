import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlanLimit,
  getModelForPlan,
  checkAndIncrementQuota,
  type QuotaConfig,
} from "../quota-service";
import type { User } from "~/domain/entities/user";
import type { UserRepository } from "~/domain/repositories/user-repository";

const BASE_CONFIG: QuotaConfig = { standardLimit: 500, premiumLimit: 2000 };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test",
    passwordHash: null,
    provider: "email",
    providerId: null,
    language: "fr",
    plan: "free_trial",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    questionsThisMonth: 0,
    questionsResetAt: new Date().toISOString(),
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerified: true,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRepo(user: User): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn(),
    findByProvider: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(user),
    incrementQuestions: vi.fn().mockResolvedValue(undefined),
    resetMonthlyQuestions: vi.fn().mockResolvedValue(undefined),
  };
}

describe("getPlanLimit", () => {
  it("free_trial → 50", () => {
    expect(getPlanLimit("free_trial", BASE_CONFIG)).toBe(50);
  });

  it("standard → standardLimit", () => {
    expect(getPlanLimit("standard", BASE_CONFIG)).toBe(500);
  });

  it("premium → premiumLimit", () => {
    expect(getPlanLimit("premium", BASE_CONFIG)).toBe(2000);
  });

  it("expired → 0", () => {
    expect(getPlanLimit("expired", BASE_CONFIG)).toBe(0);
  });
});

describe("getModelForPlan", () => {
  const env = {
    WORKERS_AI_MODEL_FREE: "free-model",
    WORKERS_AI_MODEL_STANDARD: "standard-model",
  };

  it("free_trial → free model", () => {
    expect(getModelForPlan("free_trial", env)).toBe("free-model");
  });

  it("standard → standard model", () => {
    expect(getModelForPlan("standard", env)).toBe("standard-model");
  });

  it("premium → standard model", () => {
    expect(getModelForPlan("premium", env)).toBe("standard-model");
  });

  it("expired → free model", () => {
    expect(getModelForPlan("expired", env)).toBe("free-model");
  });
});

describe("checkAndIncrementQuota", () => {
  it("autorise un utilisateur en essai avec quota disponible", async () => {
    const user = makeUser({ plan: "free_trial", questionsThisMonth: 0 });
    const repo = makeRepo(user);

    const result = await checkAndIncrementQuota(user, repo, BASE_CONFIG);

    expect(result.allowed).toBe(true);
    expect(repo.incrementQuestions).toHaveBeenCalledWith("user-1");
  });

  it("bloque un plan expired", async () => {
    const user = makeUser({ plan: "expired", questionsThisMonth: 0 });
    const repo = makeRepo(user);

    const result = await checkAndIncrementQuota(user, repo, BASE_CONFIG);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("plan_expired");
    expect(repo.incrementQuestions).not.toHaveBeenCalled();
  });

  it("bloque quand le quota est dépassé", async () => {
    const user = makeUser({ plan: "standard", questionsThisMonth: 500 });
    const repo = makeRepo(user);

    const result = await checkAndIncrementQuota(user, repo, BASE_CONFIG);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("quota_exceeded");
    expect(result.questionsLimit).toBe(500);
  });

  it("bloque quand l'essai gratuit a expiré", async () => {
    const user = makeUser({
      plan: "free_trial",
      trialEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    const repo = makeRepo(user);

    const result = await checkAndIncrementQuota(user, repo, BASE_CONFIG);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("trial_expired");
    expect(repo.update).toHaveBeenCalledWith("user-1", { plan: "expired" });
  });

  it("autorise un utilisateur premium sous la limite", async () => {
    const user = makeUser({ plan: "premium", questionsThisMonth: 999 });
    const repo = makeRepo(user);

    const result = await checkAndIncrementQuota(user, repo, BASE_CONFIG);

    expect(result.allowed).toBe(true);
    expect(result.questionsLimit).toBe(2000);
  });
});
