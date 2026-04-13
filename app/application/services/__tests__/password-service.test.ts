import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../password-service";

describe("password-service", () => {
  it("hash produit un résultat différent du mot de passe", async () => {
    const hash = await hashPassword("Password1");
    expect(hash).not.toBe("Password1");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verify retourne true pour le bon mot de passe", async () => {
    const hash = await hashPassword("Password1");
    const result = await verifyPassword("Password1", hash);
    expect(result).toBe(true);
  });

  it("verify retourne false pour un mauvais mot de passe", async () => {
    const hash = await hashPassword("Password1");
    const result = await verifyPassword("WrongPassword1", hash);
    expect(result).toBe(false);
  });
});
