import type { Route } from "./+types/api.auth.apple.callback";
import { redirect } from "react-router";
import { appleOAuth } from "~/application/services/auth-service";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { D1RefreshTokenRepository } from "~/infrastructure/repositories/d1-refresh-token-repository";
import { createAppleOAuthClient } from "~/infrastructure/oauth/apple-oauth-client";
import { setAuthCookies } from "~/lib/auth/cookies";

/**
 * Apple sends the callback as a form_post (POST request with form body).
 * The `user` field is only sent on first sign-in and contains name JSON.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const url = new URL(request.url);
  const formData = await request.formData().catch(() => null);

  const code = formData?.get("code")?.toString();
  const errorParam = formData?.get("error")?.toString();
  const idToken = formData?.get("id_token")?.toString();

  // Apple sends user JSON only on first auth
  const userJsonStr = formData?.get("user")?.toString();
  let firstName: string | undefined;
  let lastName: string | undefined;
  if (userJsonStr) {
    try {
      const appleUserData = JSON.parse(userJsonStr) as {
        name?: { firstName?: string; lastName?: string };
      };
      firstName = appleUserData.name?.firstName;
      lastName = appleUserData.name?.lastName;
    } catch {
      // Ignore parse errors
    }
  }

  if (errorParam || !code) {
    return redirect("/login?error=apple_auth_failed");
  }

  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  const appleClient = createAppleOAuthClient(env as Record<string, string>);

  if (!jwtSecret || !appleClient) {
    return redirect("/login?error=apple_not_configured");
  }

  const redirectUri = `${url.origin}/api/auth/apple/callback`;

  const deps = {
    userRepo: new D1UserRepository(env.DB),
    refreshTokenRepo: new D1RefreshTokenRepository(env.DB),
    jwtSecret,
    appleClient,
  };

  try {
    const { tokens } = await appleOAuth(
      code,
      redirectUri,
      firstName,
      lastName,
      idToken,
      deps
    );

    const headers = new Headers();
    setAuthCookies(headers, tokens, !import.meta.env.DEV);
    headers.set("Location", "/chat");

    return new Response(null, { status: 302, headers });
  } catch (error) {
    console.error("Apple OAuth error:", error);
    return redirect("/login?error=apple_auth_failed");
  }
}
