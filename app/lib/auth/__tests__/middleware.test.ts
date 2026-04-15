import { describe, it, expect, vi } from "vitest";
import { requireAuth, optionalAuth } from "../middleware";
import { createAccessToken } from "~/application/services/token-service";
import * as cookies from "../cookies";

const JWT_SECRET = "test-secret-32-chars-long-enough";

describe("requireAuth", () => {
  it("lève un redirect vers /login si pas de cookie", async () => {
    vi.spyOn(cookies, "getAccessToken").mockReturnValue(null);
    const request = new Request("https://example.com/chat");
    try {
      await requireAuth(request, JWT_SECRET);
      expect.fail("Devrait avoir redirigé");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const location = (err as Response).headers.get("Location");
      expect(location).toBe("/login");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("lève un redirect vers /login si token invalide", async () => {
    vi.spyOn(cookies, "getAccessToken").mockReturnValue("invalid.token.here");
    const request = new Request("https://example.com/chat");
    try {
      await requireAuth(request, JWT_SECRET);
      expect.fail("Devrait avoir redirigé");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const location = (err as Response).headers.get("Location");
      expect(location).toBe("/login");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("retourne userId et email si token valide", async () => {
    const token = await createAccessToken("user-42", "alice@example.com", JWT_SECRET);
    vi.spyOn(cookies, "getAccessToken").mockReturnValue(token);
    const request = new Request("https://example.com/chat");

    const result = await requireAuth(request, JWT_SECRET);

    expect(result.userId).toBe("user-42");
    expect(result.email).toBe("alice@example.com");
    vi.restoreAllMocks();
  });
});

describe("optionalAuth", () => {
  it("retourne null si pas de cookie", async () => {
    vi.spyOn(cookies, "getAccessToken").mockReturnValue(null);
    const request = new Request("https://example.com/chat");
    const result = await optionalAuth(request, JWT_SECRET);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("retourne null si token invalide", async () => {
    vi.spyOn(cookies, "getAccessToken").mockReturnValue("bad.token.value");
    const request = new Request("https://example.com/chat");
    const result = await optionalAuth(request, JWT_SECRET);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it("retourne userId et email si token valide", async () => {
    const token = await createAccessToken("user-99", "bob@example.com", JWT_SECRET);
    vi.spyOn(cookies, "getAccessToken").mockReturnValue(token);
    const request = new Request("https://example.com/chat");

    const result = await optionalAuth(request, JWT_SECRET);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-99");
    expect(result?.email).toBe("bob@example.com");
    vi.restoreAllMocks();
  });
});
