import type { User, UserPlan } from "~/domain/entities/user";
import type { UserRepository } from "~/domain/repositories/user-repository";

export interface QuotaConfig {
  standardLimit: number;
  premiumLimit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: "quota_exceeded" | "plan_expired" | "trial_expired";
  questionsUsed: number;
  questionsLimit: number | null;
}

const DEFAULT_QUOTA: QuotaConfig = {
  standardLimit: 500,
  premiumLimit: 2000,
};

/**
 * Returns the monthly question limit for a given plan.
 * null = unlimited (or handled separately for premium).
 */
export function getPlanLimit(plan: UserPlan, config: QuotaConfig = DEFAULT_QUOTA): number | null {
  switch (plan) {
    case "free_trial":
      return 50; // 50 questions during trial
    case "standard":
      return config.standardLimit;
    case "premium":
      return config.premiumLimit;
    case "expired":
      return 0;
    default:
      return 0;
  }
}

/**
 * Selects the AI model based on the user plan.
 */
export function getModelForPlan(
  plan: UserPlan,
  env: Record<string, string>
): string {
  switch (plan) {
    case "premium":
      return env.WORKERS_AI_MODEL_STANDARD ?? "@cf/meta/llama-3.1-70b-instruct";
    case "standard":
      return env.WORKERS_AI_MODEL_STANDARD ?? "@cf/meta/llama-3.1-70b-instruct";
    case "free_trial":
    case "expired":
    default:
      return env.WORKERS_AI_MODEL_FREE ?? "@cf/meta/llama-3.1-8b-instruct";
  }
}

/**
 * Checks if the user is allowed to send a message.
 * Handles trial expiry, monthly reset, and quota enforcement.
 */
export async function checkAndIncrementQuota(
  user: User,
  userRepo: UserRepository,
  config: QuotaConfig = DEFAULT_QUOTA
): Promise<QuotaCheckResult> {
  // Check expired plan
  if (user.plan === "expired") {
    return {
      allowed: false,
      reason: "plan_expired",
      questionsUsed: user.questionsThisMonth,
      questionsLimit: 0,
    };
  }

  // Check trial expiry
  if (user.plan === "free_trial" && user.trialEndsAt) {
    if (new Date(user.trialEndsAt).getTime() < Date.now()) {
      await userRepo.update(user.id, { plan: "expired" });
      return {
        allowed: false,
        reason: "trial_expired",
        questionsUsed: user.questionsThisMonth,
        questionsLimit: 0,
      };
    }
  }

  // Monthly reset: if questionsResetAt is >30 days ago, reset counter
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (
    user.questionsResetAt &&
    Date.now() - new Date(user.questionsResetAt).getTime() > thirtyDaysMs
  ) {
    await userRepo.resetMonthlyQuestions(user.id);
    // Reload updated count
    const refreshed = await userRepo.findById(user.id);
    if (refreshed) {
      return checkAndIncrementQuota(refreshed, userRepo, config);
    }
  }

  const limit = getPlanLimit(user.plan, config);

  if (limit !== null && user.questionsThisMonth >= limit) {
    return {
      allowed: false,
      reason: "quota_exceeded",
      questionsUsed: user.questionsThisMonth,
      questionsLimit: limit,
    };
  }

  // Increment counter
  await userRepo.incrementQuestions(user.id);

  return {
    allowed: true,
    questionsUsed: user.questionsThisMonth + 1,
    questionsLimit: limit,
  };
}
