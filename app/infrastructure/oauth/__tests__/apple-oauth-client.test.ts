import { describe, it, expect } from "vitest";
import { AppleOAuthClient, createAppleOAuthClient } from "../apple-oauth-client";

const config = {
  clientId: "com.example.app",
  teamId: "TEAM123",
  keyId: "KEY123",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
};

describe("AppleOAuthClient", () => {
  it("génère une URL d'autorisation avec les bons paramètres", () => {
    const client = new AppleOAuthClient(config);
    const url = client.getAuthorizationUrl("https://app.example.com/api/auth/apple/callback");

    expect(url).toContain("appleid.apple.com/auth/authorize");
    expect(url).toContain("client_id=com.example.app");
    expect(url).toContain("response_mode=form_post");
    expect(url).toContain("scope=name+email");
  });

  it("extrait les infos utilisateur du id_token", () => {
    const client = new AppleOAuthClient(config);

    // Create a minimal JWT payload (base64url encoded)
    const header = btoa(JSON.stringify({ alg: "ES256", kid: "key" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const payload = btoa(JSON.stringify({ sub: "user-sub-123", email: "user@privaterelay.appleid.com" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const fakeToken = `${header}.${payload}.fakesignature`;

    const user = client.getUserFromIdToken(fakeToken, "Alice");
    expect(user.id).toBe("user-sub-123");
    expect(user.email).toBe("user@privaterelay.appleid.com");
    expect(user.name).toBe("Alice");
  });

  it("lève une erreur si le token n'a pas de sub", () => {
    const client = new AppleOAuthClient(config);
    const header = btoa(JSON.stringify({ alg: "ES256" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const payload = btoa(JSON.stringify({ email: "x@example.com" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const fakeToken = `${header}.${payload}.fakesig`;

    expect(() => client.getUserFromIdToken(fakeToken)).toThrow("missing sub");
  });
});

describe("createAppleOAuthClient", () => {
  it("retourne null si les variables manquent", () => {
    expect(createAppleOAuthClient({})).toBeNull();
    expect(createAppleOAuthClient({ APPLE_CLIENT_ID: "id" })).toBeNull();
  });

  it("retourne un client si toutes les variables sont présentes", () => {
    const client = createAppleOAuthClient({
      APPLE_CLIENT_ID: "id",
      APPLE_TEAM_ID: "team",
      APPLE_KEY_ID: "key",
      APPLE_PRIVATE_KEY: "pk",
    });
    expect(client).toBeInstanceOf(AppleOAuthClient);
  });
});
