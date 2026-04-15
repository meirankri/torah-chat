import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLanguage } from "../use-language";
import { isRTL, SUPPORTED_LANGUAGES } from "~/i18n/config";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "fr",
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

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
    expect(isRTL("xx")).toBe(false);
  });
});

describe("SUPPORTED_LANGUAGES", () => {
  it("contient fr, en, he", () => {
    expect(SUPPORTED_LANGUAGES).toContain("fr");
    expect(SUPPORTED_LANGUAGES).toContain("en");
    expect(SUPPORTED_LANGUAGES).toContain("he");
  });

  it("contient exactement 3 langues", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(3);
  });
});

describe("useLanguage", () => {
  beforeEach(() => {
    // Reset document state
    document.documentElement.lang = "fr";
    document.documentElement.dir = "ltr";
    // Mock fetch for profile update (fire-and-forget)
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  it("retourne currentLanguage depuis i18n", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.currentLanguage).toBe("fr");
  });

  it("retourne rtl=false pour le français", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.rtl).toBe(false);
  });

  it("expose changeLanguage comme fonction", () => {
    const { result } = renderHook(() => useLanguage());
    expect(typeof result.current.changeLanguage).toBe("function");
  });

  it("expose supportedLanguages", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.supportedLanguages).toEqual(SUPPORTED_LANGUAGES);
  });

  it("changeLanguage met à jour document.documentElement.lang", async () => {
    const { result } = renderHook(() => useLanguage());
    await act(async () => {
      result.current.changeLanguage("en");
    });
    expect(document.documentElement.lang).toBe("en");
  });

  it("changeLanguage met dir=rtl pour l'hébreu", async () => {
    const { result } = renderHook(() => useLanguage());
    await act(async () => {
      result.current.changeLanguage("he");
    });
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("changeLanguage met dir=ltr pour le français", async () => {
    document.documentElement.dir = "rtl"; // simulate RTL state
    const { result } = renderHook(() => useLanguage());
    await act(async () => {
      result.current.changeLanguage("fr");
    });
    expect(document.documentElement.dir).toBe("ltr");
  });
});
