import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRTL, detectLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_COOKIE } from "../config";

// ─── isRTL ───────────────────────────────────────────────────────────────────

describe("isRTL", () => {
  it("retourne true pour l'hébreu", () => {
    expect(isRTL("he")).toBe(true);
  });

  it("retourne false pour le français", () => {
    expect(isRTL("fr")).toBe(false);
  });

  it("retourne false pour l'anglais", () => {
    expect(isRTL("en")).toBe(false);
  });

  it("retourne false pour une langue inconnue", () => {
    expect(isRTL("zh")).toBe(false);
    expect(isRTL("")).toBe(false);
    expect(isRTL("arabic")).toBe(false); // non supporté pour l'instant
  });
});

// ─── SUPPORTED_LANGUAGES ─────────────────────────────────────────────────────

describe("SUPPORTED_LANGUAGES", () => {
  it("inclut fr, en, he", () => {
    expect(SUPPORTED_LANGUAGES).toContain("fr");
    expect(SUPPORTED_LANGUAGES).toContain("en");
    expect(SUPPORTED_LANGUAGES).toContain("he");
  });

  it("contient exactement 3 langues", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(3);
  });
});

// ─── DEFAULT_LANGUAGE ────────────────────────────────────────────────────────

describe("DEFAULT_LANGUAGE", () => {
  it("est 'fr' (français)", () => {
    expect(DEFAULT_LANGUAGE).toBe("fr");
  });
});

// ─── detectLanguage ──────────────────────────────────────────────────────────

describe("detectLanguage", () => {
  beforeEach(() => {
    // Reset cookie
    document.cookie = `${LANGUAGE_COOKIE}=; path=/; max-age=0`;
    // Reset navigator language mock
    vi.restoreAllMocks();
  });

  it("retourne DEFAULT_LANGUAGE si aucun cookie ni navigator", () => {
    // Mock navigator.language to an unsupported value
    vi.spyOn(navigator, "language", "get").mockReturnValue("de");
    const lang = detectLanguage();
    expect(lang).toBe(DEFAULT_LANGUAGE);
  });

  it("retourne la langue depuis le cookie si présent et supportée", () => {
    document.cookie = `${LANGUAGE_COOKIE}=en; path=/`;
    const lang = detectLanguage();
    expect(lang).toBe("en");
  });

  it("retourne la langue depuis le cookie hébreu", () => {
    document.cookie = `${LANGUAGE_COOKIE}=he; path=/`;
    const lang = detectLanguage();
    expect(lang).toBe("he");
  });

  it("fallback vers DEFAULT si le cookie contient une langue non supportée", () => {
    // Set cookie to unsupported language
    document.cookie = `${LANGUAGE_COOKIE}=xx; path=/`;
    vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
    const lang = detectLanguage();
    // "xx" → not supported → DEFAULT_LANGUAGE
    expect(lang).toBe(DEFAULT_LANGUAGE);
  });
});
