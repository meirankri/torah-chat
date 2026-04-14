import { importPKCS8, SignJWT, decodeJwt } from "jose";

interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token: string;
}

interface AppleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
}

export interface AppleUserInfo {
  id: string;
  email: string;
  name: string;
}

const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";

/**
 * Generate a client_secret JWT for Apple Sign-In.
 * Apple requires a signed JWT (ES256) using the private key from App Store Connect.
 */
async function generateClientSecret(params: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): Promise<string> {
  const privateKey = await importPKCS8(params.privateKey, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: params.keyId })
    .setIssuedAt()
    .setIssuer(params.teamId)
    .setAudience("https://appleid.apple.com")
    .setSubject(params.clientId)
    .setExpirationTime("5m")
    .sign(privateKey);
}

export interface AppleOAuthConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}

export class AppleOAuthClient {
  constructor(private readonly config: AppleOAuthConfig) {}

  getAuthorizationUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "name email",
      response_mode: "form_post",
    });
    return `${APPLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<AppleTokenResponse> {
    const clientSecret = await generateClientSecret(this.config);

    const response = await fetch(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apple token exchange failed: ${errorText}`);
    }

    return response.json() as Promise<AppleTokenResponse>;
  }

  getUserFromIdToken(idToken: string, name?: string): AppleUserInfo {
    const payload = decodeJwt(idToken) as AppleIdTokenPayload;

    if (!payload.sub) {
      throw new Error("Invalid Apple ID token: missing sub");
    }

    const email = payload.email ?? `${payload.sub}@privaterelay.appleid.com`;

    return {
      id: payload.sub,
      email,
      name: name ?? email.split("@")[0] ?? payload.sub,
    };
  }
}

export function createAppleOAuthClient(env: Record<string, string>): AppleOAuthClient | null {
  const clientId = env.APPLE_CLIENT_ID;
  const teamId = env.APPLE_TEAM_ID;
  const keyId = env.APPLE_KEY_ID;
  const privateKey = env.APPLE_PRIVATE_KEY;

  if (!clientId || !teamId || !keyId || !privateKey) return null;

  return new AppleOAuthClient({ clientId, teamId, keyId, privateKey });
}
