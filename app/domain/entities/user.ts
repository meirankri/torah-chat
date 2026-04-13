export type UserPlan = "free_trial" | "standard" | "premium" | "expired";
export type AuthProvider = "email" | "google" | "apple";
export type Language = "fr" | "en" | "he";

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  provider: AuthProvider;
  providerId: string | null;
  language: Language;
  plan: UserPlan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  questionsThisMonth: number;
  questionsResetAt: string | null;
  trialEndsAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
  provider: AuthProvider;
  providerId?: string;
  language: Language;
}
