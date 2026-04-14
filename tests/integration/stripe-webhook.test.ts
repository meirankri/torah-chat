import { describe, it, expect, vi } from "vitest";
import {
  handleCheckoutCompleted,
  handleSubscriptionChange,
} from "../../app/application/services/stripe-service";
import type { UserRepository } from "../../app/domain/repositories/user-repository";
import type { User } from "../../app/domain/entities/user";
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
    stripeCustomerId: "cus_123",
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

function makeRepo(user: User): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(user),
    findByEmail: vi.fn(),
    findByProvider: vi.fn(),
    findByStripeCustomerId: vi.fn().mockResolvedValue(user),
    findUsersWithTrialEndingOn: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(user),
    incrementQuestions: vi.fn(),
    resetMonthlyQuestions: vi.fn(),
  };
}

describe("handleCheckoutCompleted", () => {
  it("met à jour le plan et subscriptionId après checkout réussi", async () => {
    const user = makeUser();
    const repo = makeRepo(user);

    const subscription = {
      id: "sub_123",
      items: { data: [{ price: { id: "price_standard_123" } }] },
      status: "active",
    };

    const stripe = {
      subscriptions: { retrieve: vi.fn().mockResolvedValue(subscription) },
    };

    const session: Partial<Stripe.CheckoutSession> = {
      metadata: { userId: "user-1" },
      subscription: "sub_123",
      customer: "cus_123",
    };

    await handleCheckoutCompleted(
      session as Stripe.CheckoutSession,
      { stripe: stripe as unknown as Stripe, userRepo: repo, appUrl: "http://localhost" },
      PLAN_CONFIG
    );

    expect(repo.update).toHaveBeenCalledWith("user-1", {
      plan: "standard",
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
    });
  });

  it("ne fait rien si userId manquant dans metadata", async () => {
    const repo = makeRepo(makeUser());
    const stripe = { subscriptions: { retrieve: vi.fn() } };

    const session: Partial<Stripe.CheckoutSession> = {
      metadata: {},
      subscription: "sub_123",
    };

    await handleCheckoutCompleted(
      session as Stripe.CheckoutSession,
      { stripe: stripe as unknown as Stripe, userRepo: repo, appUrl: "http://localhost" },
      PLAN_CONFIG
    );

    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionChange", () => {
  it("met à jour le plan à expired quand subscription annulée", async () => {
    const user = makeUser();
    const repo = makeRepo(user);

    const subscription: Partial<Stripe.Subscription> = {
      id: "sub_123",
      metadata: { userId: "user-1" },
      customer: "cus_123",
      status: "canceled",
      items: { data: [{ price: { id: "price_standard_123" } }] } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    await handleSubscriptionChange(
      subscription as Stripe.Subscription,
      { stripe: {} as Stripe, userRepo: repo, appUrl: "http://localhost" },
      PLAN_CONFIG
    );

    expect(repo.update).toHaveBeenCalledWith("user-1", {
      plan: "expired",
      stripeSubscriptionId: "sub_123",
    });
  });

  it("met à jour le plan à premium quand subscription active avec price premium", async () => {
    const user = makeUser();
    const repo = makeRepo(user);

    const subscription: Partial<Stripe.Subscription> = {
      id: "sub_456",
      metadata: { userId: "user-1" },
      customer: "cus_123",
      status: "active",
      items: { data: [{ price: { id: "price_premium_123" } }] } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    await handleSubscriptionChange(
      subscription as Stripe.Subscription,
      { stripe: {} as Stripe, userRepo: repo, appUrl: "http://localhost" },
      PLAN_CONFIG
    );

    expect(repo.update).toHaveBeenCalledWith("user-1", {
      plan: "premium",
      stripeSubscriptionId: "sub_456",
    });
  });
});
