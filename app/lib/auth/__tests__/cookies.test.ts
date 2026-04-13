import { describe, it, expect } from "vitest";
import {
  setAuthCookies,
  clearAuthCookies,
  parseCookies,
} from "../cookies";

describe("cookies", () => {
  describe("setAuthCookies", () => {
    it("ajoute les cookies access_token et refresh_token", () => {
      const headers = new Headers();
      setAuthCookies(
        headers,
        { accessToken: "abc123", refreshToken: "def456" },
        false
      );

      const cookies = headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toContain("access_token=abc123");
      expect(cookies[1]).toContain("refresh_token=def456");
      expect(cookies[0]).toContain("HttpOnly");
      expect(cookies[0]).toContain("SameSite=Lax");
    });

    it("ajoute Secure en production", () => {
      const headers = new Headers();
      setAuthCookies(
        headers,
        { accessToken: "abc", refreshToken: "def" },
        true
      );

      const cookies = headers.getSetCookie();
      expect(cookies[0]).toContain("Secure");
    });
  });

  describe("clearAuthCookies", () => {
    it("set Max-Age=0 pour les deux cookies", () => {
      const headers = new Headers();
      clearAuthCookies(headers, false);

      const cookies = headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toContain("Max-Age=0");
      expect(cookies[1]).toContain("Max-Age=0");
    });
  });

  describe("parseCookies", () => {
    it("parse un cookie header avec access_token", () => {
      const cookies = parseCookies("access_token=mytoken; refresh_token=other");
      expect(cookies["access_token"]).toBe("mytoken");
      expect(cookies["refresh_token"]).toBe("other");
    });

    it("parse un seul cookie", () => {
      const cookies = parseCookies("access_token=abc");
      expect(cookies["access_token"]).toBe("abc");
    });

    it("retourne un objet vide pour une chaîne vide", () => {
      const cookies = parseCookies("");
      expect(Object.keys(cookies)).toHaveLength(0);
    });

    it("gère les valeurs contenant des =", () => {
      const cookies = parseCookies("token=abc=def=ghi");
      expect(cookies["token"]).toBe("abc=def=ghi");
    });
  });
});
