import type { Route } from "./+types/api.auth.refresh";
import { refreshTokens } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { getRefreshToken } from "~/lib/auth/cookies";
import { setAuthCookies } from "~/lib/auth/cookies";

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

  const refreshToken = getRefreshToken(request);
  if (!refreshToken) {
    return Response.json(
      { error: "Refresh token manquant" },
      { status: 401 }
    );
  }

  const deps = {
    userRepo: new D1UserRepository(env.DB),
    refreshTokenRepo: new D1RefreshTokenRepository(env.DB),
    jwtSecret,
  };

  try {
    const tokens = await refreshTokens(refreshToken, deps);

    const headers = new Headers();
    setAuthCookies(headers, tokens, !import.meta.env.DEV);
    headers.set("Content-Type", "application/json");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Token refresh failed";
    return Response.json({ error: message }, { status: 401 });
  }
}
