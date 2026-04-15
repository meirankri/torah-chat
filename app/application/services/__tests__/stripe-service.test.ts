import { describe, it, expect, vi } from "vitest";
import {
  subscriptionStatusToPlan,
  resolvePlanFromPrice,
  ensureStripeCustomer,
  handleCheckoutCompleted,
  handleSubscriptionChange,
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

describe("handleCheckoutCompleted", () => {
  function makeUserRepo(overrides = {}) {
    return {
      findById: vi.fn().mockResolvedValue(makeUser()),
      findByEmail: vi.fn(),
      findByProvider: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      findUsersWithTrialEndingOn: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(makeUser()),
      incrementQuestions: vi.fn(),
      resetMonthlyQuestions: vi.fn(),
      ...overrides,
    } as unknown as UserRepository;
  }

  it("ne fait rien si userId absent des metadata", async () => {
    const session = { metadata: {}, subscription: "sub_1", customer: "cus_1" } as unknown as Stripe.CheckoutSession;
    const userRepo = makeUserRepo();
    const stripe = { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe;

    await handleCheckoutCompleted(session, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it("ne fait rien si subscription absente", async () => {
    const session = { metadata: { userId: "user-1" }, subscription: null, customer: "cus_1" } as unknown as Stripe.CheckoutSession;
    const userRepo = makeUserRepo();
    const stripe = { subscriptions: { retrieve: vi.fn() } } as unknown as Stripe;

    await handleCheckoutCompleted(session, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("met à jour le plan selon le priceId", async () => {
    const session = {
      metadata: { userId: "user-1" },
      subscription: "sub_abc",
      customer: "cus_1",
    } as unknown as Stripe.CheckoutSession;
    const userRepo = makeUserRepo();
    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          items: { data: [{ price: { id: "price_standard_123" } }] },
        }),
      },
    } as unknown as Stripe;

    await handleCheckoutCompleted(session, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({
      plan: "standard",
      stripeSubscriptionId: "sub_abc",
    }));
  });
});

describe("handleSubscriptionChange", () => {
  function makeUserRepo(overrides = {}) {
    return {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByProvider: vi.fn(),
      findByStripeCustomerId: vi.fn().mockResolvedValue(makeUser({ id: "user-from-cus" })),
      findUsersWithTrialEndingOn: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(makeUser()),
      incrementQuestions: vi.fn(),
      resetMonthlyQuestions: vi.fn(),
      ...overrides,
    } as unknown as UserRepository;
  }

  it("met à jour le plan via userId dans metadata", async () => {
    const subscription = {
      metadata: { userId: "user-1" },
      customer: "cus_1",
      status: "active",
      items: { data: [{ price: { id: "price_standard_123" } }] },
      stripeSubscriptionId: "sub_1",
    } as unknown as Stripe.Subscription;

    const userRepo = makeUserRepo();
    const stripe = {} as unknown as Stripe;

    await handleSubscriptionChange(subscription, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({ plan: "standard" }));
  });

  it("cherche par customerId si userId absent des metadata", async () => {
    const subscription = {
      metadata: {},
      customer: "cus_lookup",
      status: "active",
      items: { data: [{ price: { id: "price_premium_123" } }] },
      stripeSubscriptionId: "sub_2",
    } as unknown as Stripe.Subscription;

    const userRepo = makeUserRepo();
    const stripe = {} as unknown as Stripe;

    await handleSubscriptionChange(subscription, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(userRepo.findByStripeCustomerId).toHaveBeenCalledWith("cus_lookup");
    expect(userRepo.update).toHaveBeenCalledWith("user-from-cus", expect.objectContaining({ plan: "premium" }));
  });

  it("marque expired si statut canceled", async () => {
    const subscription = {
      metadata: { userId: "user-1" },
      customer: "cus_1",
      status: "canceled",
      items: { data: [{ price: { id: "price_standard_123" } }] },
      stripeSubscriptionId: "sub_3",
    } as unknown as Stripe.Subscription;

    const userRepo = makeUserRepo();
    const stripe = {} as unknown as Stripe;

    await handleSubscriptionChange(subscription, { stripe, userRepo, appUrl: "http://localhost" }, PLAN_CONFIG);

    expect(userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({ plan: "expired" }));
  });
});
