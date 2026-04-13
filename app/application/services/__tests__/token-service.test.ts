import { describe, it, expect } from "vitest";
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from "../token-service";

const TEST_SECRET = "test-secret-key-at-least-32-chars-long";

describe("token-service", () => {
  it("crée et vérifie un access token", async () => {
    const token = await createAccessToken("user-1", "test@example.com", TEST_SECRET);
    expect(token).toBeTruthy();

    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });

  it("crée et vérifie un refresh token", async () => {
    const token = await createRefreshToken("user-1", TEST_SECRET);
    expect(token).toBeTruthy();

    const payload = await verifyRefreshToken(token, TEST_SECRET);
    expect(payload.sub).toBe("user-1");
  });

  it("rejette un token avec un mauvais secret", async () => {
    const token = await createAccessToken("user-1", "test@example.com", TEST_SECRET);

    await expect(
      verifyAccessToken(token, "wrong-secret-key-at-least-32-chars-long")
    ).rejects.toThrow();
  });

  it("rejette un token invalide", async () => {
    await expect(
      verifyAccessToken("not-a-valid-jwt", TEST_SECRET)
    ).rejects.toThrow();
  });

  it("hashToken produit un hash SHA-256 hex", async () => {
    const hash = await hashToken("my-test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashToken est déterministe", async () => {
    const hash1 = await hashToken("same-token");
    const hash2 = await hashToken("same-token");
    expect(hash1).toBe(hash2);
  });

  it("hashToken produit des résultats différents pour des inputs différents", async () => {
    const hash1 = await hashToken("token-a");
    const hash2 = await hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });
});
