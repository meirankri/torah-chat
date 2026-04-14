import type { Route } from "./+types/api.stripe.portal";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { createStripeClient } from "~/infrastructure/stripe/stripe-client";
import { createPortalSession } from "~/application/services/stripe-service";

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

  const userRepo = new D1UserRepository((context.cloudflare.env as { DB: D1Database }).DB);
  const appUrl = env.APP_URL || "http://localhost:5173";
  const stripe = createStripeClient(stripeSecretKey);

  try {
    const url = await createPortalSession(auth.userId, { stripe, userRepo, appUrl });
    return Response.json({ url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return Response.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
