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
