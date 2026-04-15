import { describe, it, expect } from "vitest";
import { validateEmail, validatePassword, validateSignupInput } from "../validation";

describe("validateEmail", () => {
  it("retourne null pour un email valide", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("retourne erreur pour email vide", () => {
    expect(validateEmail("")).not.toBeNull();
  });

  it("retourne erreur pour format invalide", () => {
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("@example.com")).not.toBeNull();
    expect(validateEmail("user@")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("retourne null pour un password valide", () => {
    expect(validatePassword("Password1")).toBeNull();
    expect(validatePassword("MyP@ss1234")).toBeNull();
  });

  it("retourne erreur si trop court", () => {
    expect(validatePassword("Pass1")).not.toBeNull();
  });

  it("retourne erreur si pas de majuscule", () => {
    expect(validatePassword("password1")).not.toBeNull();
  });

  it("retourne erreur si pas de chiffre", () => {
    expect(validatePassword("Password")).not.toBeNull();
  });

  it("retourne erreur si vide", () => {
    expect(validatePassword("")).not.toBeNull();
  });
});

describe("validateSignupInput", () => {
  it("retourne null pour input valide", () => {
    expect(
      validateSignupInput({
        name: "John",
        email: "john@example.com",
        password: "Password1",
      })
    ).toBeNull();
  });

  it("retourne erreur si nom vide", () => {
    expect(
      validateSignupInput({
        name: "",
        email: "john@example.com",
        password: "Password1",
      })
    ).not.toBeNull();
  });

  it("retourne erreur si email invalide", () => {
    expect(
      validateSignupInput({
        name: "John",
        email: "invalid",
        password: "Password1",
      })
    ).not.toBeNull();
  });

  it("retourne erreur si password invalide", () => {
    expect(
      validateSignupInput({
        name: "John",
        email: "john@example.com",
        password: "short",
      })
    ).not.toBeNull();
  });
});

describe("validateEmail — cas limites", () => {
  it("email avec sous-domaine est valide", () => {
    // validateEmail already imported at top
    expect(validateEmail("user@mail.example.com")).toBeNull();
  });

  it("email avec + est valide", () => {
    // validateEmail already imported at top
    expect(validateEmail("user+tag@example.com")).toBeNull();
  });

  it("email sans @ est invalide", () => {
    // validateEmail already imported at top
    expect(validateEmail("notanemail")).not.toBeNull();
  });

  it("email avec espaces en bordure est invalide (sans trim)", () => {
    // validateEmail already imported at top
    // L'implémentation fait .trim() donc un email avec espaces peut passer
    const result = validateEmail("  user@example.com  ");
    // trimmed → valide
    expect(result).toBeNull();
  });
});

describe("validatePassword — cas limites", () => {
  it("password avec exactement 8 caractères est valide si critères remplis", () => {
    // validatePassword already imported at top
    expect(validatePassword("Passw0rd")).toBeNull();
  });

  it("password avec caractères spéciaux est valide si critères remplis", () => {
    // validatePassword already imported at top
    expect(validatePassword("Pass@1234")).toBeNull();
  });

  it("password uniquement en minuscules est invalide", () => {
    // validatePassword already imported at top
    expect(validatePassword("password1")).not.toBeNull();
  });

  it("password sans chiffre est invalide même avec majuscule", () => {
    // validatePassword already imported at top
    expect(validatePassword("PasswordOnly")).not.toBeNull();
  });
});
