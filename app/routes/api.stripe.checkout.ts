import type { Route } from "./+types/api.stripe.checkout";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { createStripeClient } from "~/infrastructure/stripe/stripe-client";
import { createCheckoutSession } from "~/application/services/stripe-service";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env as Record<string, string>;
  const jwtSecret = env.JWT_SECRET;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;

  if (!jwtSecret || !stripeSecretKey) {
    return Response.json({ error: "Service not configured" }, { status: 503 });
  }

  let auth: { userId: string };
  try {
    auth = await requireAuth(request, jwtSecret);
  } catch {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  let priceId: string;
  try {
    const body = await request.json() as { priceId: string };
    priceId = body.priceId;
    if (!priceId || typeof priceId !== "string") throw new Error("missing priceId");
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate priceId is one of the configured prices
  const validPrices = [env.STRIPE_PRICE_STANDARD, env.STRIPE_PRICE_PREMIUM].filter(Boolean);
  if (!validPrices.includes(priceId)) {
    return Response.json({ error: "Invalid price ID" }, { status: 400 });
  }

  const userRepo = new D1UserRepository((context.cloudflare.env as { DB: D1Database }).DB);
  const user = await userRepo.findById(auth.userId);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const stripe = createStripeClient(stripeSecretKey);
  const appUrl = env.APP_URL || "http://localhost:5173";

  try {
    const url = await createCheckoutSession(
      user.id,
      user.email,
      user.name,
      priceId,
      { stripe, userRepo, appUrl }
    );
    return Response.json({ url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
