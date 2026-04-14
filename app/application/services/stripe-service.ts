import type Stripe from "stripe";
import type { UserRepository } from "~/domain/repositories/user-repository";
import type { UserPlan } from "~/domain/entities/user";

export interface StripeDeps {
  stripe: Stripe;
  userRepo: UserRepository;
  appUrl: string;
}

export interface PlanConfig {
  priceStandard: string;
  pricePremium: string;
}

/**
 * Creates a Stripe customer and stores the ID on the user.
 * Safe to call multiple times — skips if stripeCustomerId already set.
 */
export async function ensureStripeCustomer(
  userId: string,
  email: string,
  name: string,
  deps: StripeDeps
): Promise<string> {
  const user = await deps.userRepo.findById(userId);
  if (!user) throw new Error("User not found");

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await deps.stripe.customers.create({ email, name });
  await deps.userRepo.update(userId, { stripeCustomerId: customer.id });
  return customer.id;
}

/**
 * Creates a Stripe Checkout Session for subscription.
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  name: string,
  priceId: string,
  deps: StripeDeps
): Promise<string> {
  const customerId = await ensureStripeCustomer(userId, email, name, deps);

  const session = await deps.stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${deps.appUrl}/chat?payment=success`,
    cancel_url: `${deps.appUrl}/pricing?payment=cancelled`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }
  return session.url;
}

/**
 * Creates a Stripe Billing Portal session for subscription management.
 */
export async function createPortalSession(
  userId: string,
  deps: StripeDeps
): Promise<string> {
  const user = await deps.userRepo.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.stripeCustomerId)
    throw new Error("No Stripe customer found for this user");

  const session = await deps.stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${deps.appUrl}/profile`,
  });

  return session.url;
}

/**
 * Maps a Stripe subscription status to a UserPlan.
 */
export function subscriptionStatusToPlan(
  status: Stripe.Subscription["status"]
): UserPlan {
  switch (status) {
    case "active":
    case "trialing":
      return "standard";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
    case "paused":
    default:
      return "expired";
  }
}

/**
 * Resolves the plan from a subscription's price ID.
 */
export function resolvePlanFromPrice(
  priceId: string,
  planConfig: PlanConfig
): UserPlan {
  if (priceId === planConfig.pricePremium) return "premium";
  if (priceId === planConfig.priceStandard) return "standard";
  return "standard";
}

/**
 * Handles checkout.session.completed event.
 * Sets stripeSubscriptionId and upgrades the user plan.
 */
export async function handleCheckoutCompleted(
  session: Stripe.CheckoutSession,
  deps: StripeDeps,
  planConfig: PlanConfig
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[Stripe] checkout.session.completed: missing userId in metadata");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.error("[Stripe] checkout.session.completed: missing subscription id");
    return;
  }

  const subscription = await deps.stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const plan = resolvePlanFromPrice(priceId, planConfig);

  await deps.userRepo.update(userId, {
    plan,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  });

  console.log(`[Stripe] User ${userId} upgraded to plan: ${plan}`);
}

/**
 * Handles customer.subscription.updated and customer.subscription.deleted events.
 */
export async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  deps: StripeDeps,
  planConfig: PlanConfig
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try lookup by customer ID
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    // Find user by stripeCustomerId
    const user = await deps.userRepo.findByStripeCustomerId(customerId);
    if (!user) {
      console.error(`[Stripe] subscription change: no user for customer ${customerId}`);
      return;
    }
    await applySubscriptionUpdate(user.id, subscription, deps, planConfig);
    return;
  }

  await applySubscriptionUpdate(userId, subscription, deps, planConfig);
}

async function applySubscriptionUpdate(
  userId: string,
  subscription: Stripe.Subscription,
  deps: StripeDeps,
  planConfig: PlanConfig
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const basePlan = resolvePlanFromPrice(priceId, planConfig);
  const plan =
    subscription.status === "active" || subscription.status === "trialing"
      ? basePlan
      : "expired";

  await deps.userRepo.update(userId, {
    plan,
    stripeSubscriptionId: subscription.id,
  });

  console.log(
    `[Stripe] User ${userId} plan updated to: ${plan} (status: ${subscription.status})`
  );
}
