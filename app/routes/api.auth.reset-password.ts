import type { Route } from "./+types/api.auth.reset-password";
import { resetPasswordWithEmail } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { validatePassword } from "~/lib/auth/validation";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { email: string; token: string; newPassword: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const passwordError = validatePassword(body.newPassword);
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
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
    await resetPasswordWithEmail(body.email, body.token, body.newPassword, deps);
    return Response.json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la réinitialisation";
    return Response.json({ error: message }, { status: 400 });
  }
}
