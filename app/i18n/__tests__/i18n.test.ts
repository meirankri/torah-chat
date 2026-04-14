import { describe, it, expect } from "vitest";
import fr from "../fr.json";
import en from "../en.json";
import he from "../he.json";
import { isRTL, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "../config";

describe("i18n config", () => {
  it("supporte les langues fr, en, he", () => {
    expect(SUPPORTED_LANGUAGES).toContain("fr");
    expect(SUPPORTED_LANGUAGES).toContain("en");
    expect(SUPPORTED_LANGUAGES).toContain("he");
  });

  it("la langue par défaut est fr", () => {
    expect(DEFAULT_LANGUAGE).toBe("fr");
  });

  it("détecte correctement les langues RTL", () => {
    expect(isRTL("he")).toBe(true);
    expect(isRTL("fr")).toBe(false);
    expect(isRTL("en")).toBe(false);
  });
});

describe("fichiers de traduction", () => {
  const topLevelKeys = ["common", "nav", "errors", "chat", "sidebar", "auth", "profile", "sources", "language"] as const;

  it("fr.json contient toutes les clés de premier niveau", () => {
    for (const key of topLevelKeys) {
      expect(fr).toHaveProperty(key);
    }
  });

  it("en.json contient toutes les clés de premier niveau", () => {
    for (const key of topLevelKeys) {
      expect(en).toHaveProperty(key);
    }
  });

  it("he.json contient toutes les clés de premier niveau", () => {
    for (const key of topLevelKeys) {
      expect(he).toHaveProperty(key);
    }
  });

  it("fr et en ont les mêmes clés auth", () => {
    expect(Object.keys(fr.auth)).toEqual(Object.keys(en.auth));
  });

  it("fr et he ont les mêmes clés auth", () => {
    expect(Object.keys(fr.auth)).toEqual(Object.keys(he.auth));
  });

  it("les clés sidebar.relativeDate sont présentes dans toutes les langues", () => {
    const relativeDateKeys = ["now", "minutesAgo", "hoursAgo", "yesterday", "daysAgo"];
    for (const key of relativeDateKeys) {
      expect(fr.sidebar.relativeDate).toHaveProperty(key);
      expect(en.sidebar.relativeDate).toHaveProperty(key);
      expect(he.sidebar.relativeDate).toHaveProperty(key);
    }
  });

  it("les valeurs fr ne sont pas vides", () => {
    expect(fr.chat.title).toBe("Torah Chat");
    expect(fr.common.send).toBeTruthy();
    expect(fr.auth.login.submit).toBeTruthy();
  });

  it("les valeurs he sont différentes des valeurs fr (traductions distinctes)", () => {
    expect(he.common.send).not.toBe(fr.common.send);
    expect(he.chat.inputPlaceholder).not.toBe(fr.chat.inputPlaceholder);
  });
});
