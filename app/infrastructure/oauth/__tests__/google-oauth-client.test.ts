import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleOAuthClientImpl } from "../google-oauth-client";

describe("GoogleOAuthClientImpl.getAuthorizationUrl", () => {
  it("génère une URL Google OAuth avec les bons paramètres", () => {
    const client = new GoogleOAuthClientImpl();
    const url = client.getAuthorizationUrl(
      "https://app.example.com/api/auth/google/callback",
      "my-client-id"
    );

    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=my-client-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("response_type=code");
    expect(url).toContain("scope=openid+email+profile");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });

  it("encode correctement l'URL de redirection", () => {
    const client = new GoogleOAuthClientImpl();
    const redirectUri = "https://app.example.com/api/auth/google/callback";
    const url = client.getAuthorizationUrl(redirectUri, "client-id");

    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(redirectUri);
  });
});

describe("GoogleOAuthClientImpl.exchangeCodeForToken", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("retourne les tokens Google si l'échange réussit", async () => {
    const tokenResponse = {
      access_token: "access-123",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid email profile",
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => tokenResponse,
    });

    const client = new GoogleOAuthClientImpl();
    const result = await client.exchangeCodeForToken(
      "auth-code",
      "https://app.example.com/callback",
      "client-id",
      "client-secret"
    );

    expect(result.access_token).toBe("access-123");
    expect(result.token_type).toBe("Bearer");
  });

  it("appelle le bon endpoint Google avec les bons paramètres", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok", token_type: "Bearer", expires_in: 3600, scope: "openid" }),
    });

    const client = new GoogleOAuthClientImpl();
    await client.exchangeCodeForToken("code", "https://redirect.example.com", "cid", "csecret");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    expect(init.method).toBe("POST");
  });

  it("lève une erreur si l'échange échoue", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
    });

    const client = new GoogleOAuthClientImpl();
    await expect(
      client.exchangeCodeForToken("bad-code", "https://redirect.example.com", "cid", "csecret")
    ).rejects.toThrow("Google token exchange failed");
  });
});

describe("GoogleOAuthClientImpl.getUserInfo", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("retourne les infos utilisateur Google", async () => {
    const userInfo = {
      id: "google-user-123",
      email: "alice@gmail.com",
      verified_email: true,
      name: "Alice Dupont",
      given_name: "Alice",
      family_name: "Dupont",
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => userInfo,
    });

    const client = new GoogleOAuthClientImpl();
    const result = await client.getUserInfo("access-token-123");

    expect(result.id).toBe("google-user-123");
    expect(result.email).toBe("alice@gmail.com");
    expect(result.verified_email).toBe(true);
    expect(result.name).toBe("Alice Dupont");
  });

  it("envoie le token Bearer dans l'Authorization header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "u1", email: "u@g.com", verified_email: true, name: "U" }),
    });

    const client = new GoogleOAuthClientImpl();
    await client.getUserInfo("my-access-token");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer my-access-token"
    );
  });

  it("lève une erreur si getUserInfo échoue", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const client = new GoogleOAuthClientImpl();
    await expect(client.getUserInfo("invalid-token")).rejects.toThrow(
      "Failed to fetch Google user info"
    );
  });
});
