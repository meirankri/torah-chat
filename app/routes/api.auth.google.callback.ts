import type { Route } from "./+types/api.auth.google.callback";
import { redirect } from "react-router";
import { googleOAuth } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { GoogleOAuthClientImpl } from "~/infrastructure/oauth/google-oauth-client";
import { setAuthCookies } from "~/lib/auth/cookies";

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return redirect("/login?error=google_auth_failed");
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  const clientId = (env as Record<string, string>).GOOGLE_CLIENT_ID;
  const clientSecret = (env as Record<string, string>).GOOGLE_CLIENT_SECRET;

  if (!jwtSecret || !clientId || !clientSecret) {
    return redirect("/login?error=google_not_configured");
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;

  const deps = {
    userRepo: new D1UserRepository(env.DB),
    refreshTokenRepo: new D1RefreshTokenRepository(env.DB),
    jwtSecret,
    googleClient: new GoogleOAuthClientImpl(),
    googleClientId: clientId,
    googleClientSecret: clientSecret,
  };

  try {
    const { tokens } = await googleOAuth(code, redirectUri, deps);

    const headers = new Headers();
    setAuthCookies(headers, tokens, !import.meta.env.DEV);
    headers.set("Location", "/chat");

    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("Google OAuth error:", error);
    return redirect("/login?error=google_auth_failed");
  }
}
