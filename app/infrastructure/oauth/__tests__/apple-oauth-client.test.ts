import { describe, it, expect } from "vitest";
import { AppleOAuthClient, createAppleOAuthClient } from "../apple-oauth-client";

const FAKE_CONFIG = {
  clientId: "com.example.app",
  teamId: "TEAM123456",
  keyId: "KEY123456",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
};

function buildFakeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `eyJhbGciOiJFUzI1NiJ9.${encoded}.sig`;
}

describe("AppleOAuthClient.getAuthorizationUrl", () => {
  it("génère une URL Apple OAuth avec les bons paramètres", () => {
    const client = new AppleOAuthClient(FAKE_CONFIG);
    const url = client.getAuthorizationUrl("https://app.example.com/api/auth/apple/callback");

    expect(url).toContain("appleid.apple.com/auth/authorize");
    expect(url).toContain("client_id=com.example.app");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("response_type=code");
    expect(url).toContain("response_mode=form_post");
  });

  it("encode correctement le redirect_uri", () => {
    const client = new AppleOAuthClient(FAKE_CONFIG);
    const redirectUri = "https://app.example.com/api/auth/apple/callback";
    const url = client.getAuthorizationUrl(redirectUri);

    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
  });
});

describe("AppleOAuthClient.getUserFromIdToken", () => {
  it("extrait les infos utilisateur d'un id_token valide", () => {
    const fakeToken = buildFakeJwt({
      sub: "apple-user-001",
      email: "user@example.com",
      email_verified: true,
    });

    const client = new AppleOAuthClient(FAKE_CONFIG);
    const result = client.getUserFromIdToken(fakeToken, "Alice");

    expect(result.id).toBe("apple-user-001");
    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("Alice");
  });

  it("utilise le relay email si pas d'email dans le token", () => {
    const fakeToken = buildFakeJwt({ sub: "apple-sub-xyz" });

    const client = new AppleOAuthClient(FAKE_CONFIG);
    const result = client.getUserFromIdToken(fakeToken);

    expect(result.email).toBe("apple-sub-xyz@privaterelay.appleid.com");
    expect(result.id).toBe("apple-sub-xyz");
  });

  it("lève une erreur si sub est absent du token", () => {
    const fakeToken = buildFakeJwt({ email: "user@example.com" });

    const client = new AppleOAuthClient(FAKE_CONFIG);
    expect(() => client.getUserFromIdToken(fakeToken)).toThrow(
      "Invalid Apple ID token: missing sub"
    );
  });

  it("utilise l'email comme name si name n'est pas fourni", () => {
    const fakeToken = buildFakeJwt({
      sub: "apple-sub-abc",
      email: "alice@example.com",
    });

    const client = new AppleOAuthClient(FAKE_CONFIG);
    const result = client.getUserFromIdToken(fakeToken);

    expect(result.name).toBe("alice");
  });
});

describe("createAppleOAuthClient", () => {
  it("retourne null si les variables d'env sont absentes", () => {
    expect(createAppleOAuthClient({})).toBeNull();
    expect(createAppleOAuthClient({ APPLE_CLIENT_ID: "id" })).toBeNull();
    expect(
      createAppleOAuthClient({ APPLE_CLIENT_ID: "id", APPLE_TEAM_ID: "team" })
    ).toBeNull();
  });

  it("retourne une instance si toutes les variables sont présentes", () => {
    const client = createAppleOAuthClient({
      APPLE_CLIENT_ID: "com.example.app",
      APPLE_TEAM_ID: "TEAM123",
      APPLE_KEY_ID: "KEY456",
      APPLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
    });
    expect(client).not.toBeNull();
    expect(client).toBeInstanceOf(AppleOAuthClient);
  });
});
