import { describe, it, expect, vi } from "vitest";
import {
  subscriptionStatusToPlan,
  resolvePlanFromPrice,
  ensureStripeCustomer,
} from "../stripe-service";
import type { UserRepository } from "~/domain/repositories/user-repository";
import type { User } from "~/domain/entities/user";
import type Stripe from "stripe";

const PLAN_CONFIG = {
  priceStandard: "price_standard_123",
  pricePremium: "price_premium_123",
};

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
    questionsResetAt: null,
    trialEndsAt: null,
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

describe("subscriptionStatusToPlan", () => {
  it("active → standard", () => {
    expect(subscriptionStatusToPlan("active")).toBe("standard");
  });

  it("trialing → standard", () => {
    expect(subscriptionStatusToPlan("trialing")).toBe("standard");
  });

  it("canceled → expired", () => {
    expect(subscriptionStatusToPlan("canceled")).toBe("expired");
  });

  it("past_due → expired", () => {
    expect(subscriptionStatusToPlan("past_due")).toBe("expired");
  });
});

describe("resolvePlanFromPrice", () => {
  it("price_standard → standard", () => {
    expect(resolvePlanFromPrice("price_standard_123", PLAN_CONFIG)).toBe("standard");
  });

  it("price_premium → premium", () => {
    expect(resolvePlanFromPrice("price_premium_123", PLAN_CONFIG)).toBe("premium");
  });

  it("unknown price → standard (fallback)", () => {
    expect(resolvePlanFromPrice("unknown_price", PLAN_CONFIG)).toBe("standard");
  });
});

describe("ensureStripeCustomer", () => {
  it("retourne l'ID existant sans créer un nouveau customer", async () => {
    const user = makeUser({ stripeCustomerId: "cus_existing" });
    const repo: Pick<UserRepository, "findById" | "update"> = {
      findById: vi.fn().mockResolvedValue(user),
      update: vi.fn(),
    };
    const stripe = { customers: { create: vi.fn() } };

    const result = await ensureStripeCustomer(
      "user-1",
      "test@example.com",
      "Test",
      { stripe: stripe as unknown as Stripe, userRepo: repo as unknown as UserRepository, appUrl: "http://localhost" }
    );

    expect(result).toBe("cus_existing");
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("crée un nouveau customer si absent", async () => {
    const user = makeUser({ stripeCustomerId: null });
    const repo: Pick<UserRepository, "findById" | "update"> = {
      findById: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({ ...user, stripeCustomerId: "cus_new" }),
    };
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
    };

    const result = await ensureStripeCustomer(
      "user-1",
      "test@example.com",
      "Test",
      { stripe: stripe as unknown as Stripe, userRepo: repo as unknown as UserRepository, appUrl: "http://localhost" }
    );

    expect(result).toBe("cus_new");
    expect(stripe.customers.create).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test",
    });
    expect(repo.update).toHaveBeenCalledWith("user-1", { stripeCustomerId: "cus_new" });
  });
});
