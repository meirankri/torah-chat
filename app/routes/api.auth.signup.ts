import type { Route } from "./+types/api.auth.signup";
import { signup } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { setAuthCookies } from "~/lib/auth/cookies";
import type { SignupInput } from "~/domain/entities/auth";
import { createBrevoClient } from "~/infrastructure/email/brevo-client";
import { sendWelcomeEmail } from "~/application/services/email-service";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: SignupInput;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return Response.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }

  const deps = {
    userRepo: new D1UserRepository(env.DB),
    refreshTokenRepo: new D1RefreshTokenRepository(env.DB),
    jwtSecret,
  };

  try {
    const { user, tokens } = await signup(body, deps);

    // Send welcome email (non-blocking — don't fail signup if email fails)
    const emailClient = createBrevoClient(env as Record<string, string>);
    if (emailClient) {
      const appUrl = (env as Record<string, string>).APP_URL ?? "https://torahchat.app";
      sendWelcomeEmail(
        { emailClient, appUrl },
        { email: user.email, name: user.name ?? "", trialDays: 7 }
      ).catch((err: unknown) => console.error("[Signup] Welcome email failed:", err));
    }

    const headers = new Headers();
    setAuthCookies(headers, tokens, !import.meta.env.DEV);
    headers.set("Content-Type", "application/json");

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
      }),
      { status: 201, headers }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'inscription";
    return Response.json({ error: message }, { status: 400 });
  }
}
