import type { Route } from "./+types/api.auth.apple";
import { redirect } from "react-router";
import { createAppleOAuthClient } from "~/infrastructure/oauth/apple-oauth-client";

export function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const appleClient = createAppleOAuthClient(env as Record<string, string>);

  if (!appleClient) {
    return Response.json({ error: "Apple Sign-In not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/apple/callback`;
  const authUrl = appleClient.getAuthorizationUrl(redirectUri);

  return redirect(authUrl);
}
