import type { Route } from "./+types/api.auth.logout";
import { logout } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { requireAuth } from "~/lib/auth/middleware";
import { clearAuthCookies } from "~/lib/auth/cookies";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return Response.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }

  try {
    const auth = await requireAuth(request, jwtSecret);

    const deps = {
      userRepo: new D1UserRepository(env.DB),
      refreshTokenRepo: new D1RefreshTokenRepository(env.DB),
      jwtSecret,
    };

    await logout(auth.userId, deps);

    const headers = new Headers();
    clearAuthCookies(headers, !import.meta.env.DEV);
    headers.set("Content-Type", "application/json");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    // If requireAuth throws redirect, let it through
    throw error;
  }
}
