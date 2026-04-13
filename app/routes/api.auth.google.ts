import type { Route } from "./+types/api.auth.google";
import { redirect } from "react-router";
import { GoogleOAuthClientImpl } from "~/infrastructure/oauth/google-oauth-client";

export function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const clientId = (env as Record<string, string>).GOOGLE_CLIENT_ID;

  if (!clientId) {
    return Response.json(
      { error: "Google OAuth not configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  const client = new GoogleOAuthClientImpl();
  const authUrl = client.getAuthorizationUrl(redirectUri, clientId);

  return redirect(authUrl);
}
