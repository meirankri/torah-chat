import type { Route } from "./+types/api.profile";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return Response.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }

  const auth = await requireAuth(request, jwtSecret);
  const userRepo = new D1UserRepository(env.DB);
  const user = await userRepo.findById(auth.userId);

  if (!user) {
    return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      provider: user.provider,
      questionsThisMonth: user.questionsThisMonth,
      trialEndsAt: user.trialEndsAt,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return Response.json({ error: "Auth service not configured" }, { status: 503 });
  }

  let userId: string;
  try {
    const auth = await requireAuth(request, jwtSecret);
    userId = auth.userId;
  } catch {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  if (request.method === "PATCH") {
    let body: { name?: string; language?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name, language } = body;
    const updates: { name?: string; language?: string } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return Response.json({ error: "name is required" }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return Response.json({ error: "name too long (max 100 chars)" }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (language !== undefined) {
      const SUPPORTED = ["fr", "en", "he"];
      if (!SUPPORTED.includes(language)) {
        return Response.json({ error: "unsupported language" }, { status: 400 });
      }
      updates.language = language;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const userRepo = new D1UserRepository(env.DB);
    const updated = await userRepo.update(userId, updates);
    return Response.json({ user: { name: updated.name, language: updated.language } });
  }

  if (request.method === "DELETE") {
    const userRepo = new D1UserRepository(env.DB);
    const user = await userRepo.findById(userId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Cancel Stripe subscription if any
    const stripeKey = (env as Record<string, string>).STRIPE_SECRET_KEY;
    if (stripeKey && user.stripeSubscriptionId) {
      try {
        await fetch(`https://api.stripe.com/v1/subscriptions/${user.stripeSubscriptionId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
      } catch (err) {
        console.error("[Profile DELETE] Failed to cancel Stripe subscription:", err);
        // Non-blocking — still delete the account
      }
    }

    // Delete all user data (CASCADE handles conversations, messages, sources, feedback)
    await userRepo.delete(userId);

    // Clear auth cookies
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": [
          "torah_chat_access=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
          "torah_chat_refresh=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        ].join(", "),
      },
    });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
