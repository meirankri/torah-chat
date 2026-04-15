import type { Route } from "./+types/api.stripe.webhook";
import { createStripeClient } from "~/infrastructure/stripe/stripe-client";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import {
  handleCheckoutCompleted,
  handleSubscriptionChange,
  handleInvoicePaid,
} from "~/application/services/stripe-service";
import type Stripe from "stripe";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env as Record<string, string>;
  const stripeSecretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = createStripeClient(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[Stripe Webhook] Signature verification failed:", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const userRepo = new D1UserRepository((context.cloudflare.env as { DB: D1Database }).DB);
  const appUrl = env.APP_URL || "http://localhost:5173";
  const planConfig = {
    priceStandard: env.STRIPE_PRICE_STANDARD ?? "",
    pricePremium: env.STRIPE_PRICE_PREMIUM ?? "",
  };
  const deps = { stripe, userRepo, appUrl };

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.CheckoutSession,
          deps,
          planConfig
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
          deps,
          planConfig
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription,
          deps,
          planConfig
        );
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, deps);
        break;

      case "invoice.payment_failed":
        // Log for monitoring — plan update handled via subscription.updated
        console.log(`[Stripe] Payment failed for invoice: ${(event.data.object as Stripe.Invoice).id}`);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, error);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
