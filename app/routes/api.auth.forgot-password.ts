import type { Route } from "./+types/api.auth.forgot-password";
import { forgotPassword } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { createBrevoClient } from "~/infrastructure/email/brevo-client";
import { sendPasswordResetEmail } from "~/application/services/email-service";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { email: string };
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

  // Always return success to not reveal if email exists
  try {
    const result = await forgotPassword(body.email, deps);

    if (result) {
      const emailClient = createBrevoClient(env as Record<string, string>);
      if (emailClient) {
        const appUrl = (env as Record<string, string>).APP_URL ?? "https://torahchat.app";
        await sendPasswordResetEmail(
          { emailClient, appUrl },
          { email: body.email, name: result.userName, resetToken: result.resetToken }
        ).catch((err: unknown) => console.error("[ForgotPassword] Email failed:", err));
      } else {
        // Fallback: log token when email not configured
        console.log(`[ForgotPassword] Reset token for ${body.email}: ${result.resetToken}`);
      }
    }
  } catch {
    // Silently ignore errors
  }

  return Response.json({
    message:
      "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.",
  });
}
