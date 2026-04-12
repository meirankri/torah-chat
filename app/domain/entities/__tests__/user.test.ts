import { describe, it, expect } from "vitest";
import type { User, CreateUserInput, UserPlan, AuthProvider, Language } from "../user";

describe("User entity types", () => {
  it("CreateUserInput accepte les valeurs valides", () => {
    const input: CreateUserInput = {
      email: "test@example.com",
      name: "Test User",
      provider: "email",
      language: "fr",
    };
    expect(input.email).toBe("test@example.com");
    expect(input.provider).toBe("email");
  });

  it("User entity a toutes les propriétés attendues", () => {
    const user: User = {
      id: "usr_123",
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
      trialEndsAt: "2025-01-14T00:00:00Z",
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerified: false,
      createdAt: "2025-01-07T00:00:00Z",
      updatedAt: "2025-01-07T00:00:00Z",
    };
    expect(user.plan).toBe("free_trial");
    expect(user.questionsThisMonth).toBe(0);
  });

  it("UserPlan couvre tous les plans prévus", () => {
    const plans: UserPlan[] = ["free_trial", "standard", "premium", "expired"];
    expect(plans).toHaveLength(4);
  });

  it("AuthProvider couvre les providers prévus", () => {
    const providers: AuthProvider[] = ["email", "google", "apple"];
    expect(providers).toHaveLength(3);
  });

  it("Language couvre les langues prévues", () => {
    const languages: Language[] = ["fr", "en", "he"];
    expect(languages).toHaveLength(3);
  });
});
