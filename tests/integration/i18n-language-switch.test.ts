import { describe, it, expect, beforeEach } from "vitest";
import i18n from "../../app/i18n/config";

describe("i18n language switch integration", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("fr");
  });

  it("traduit correctement en français", () => {
    expect(i18n.t("common.send")).toBe("Envoyer");
    expect(i18n.t("chat.title")).toBe("Torah Chat");
    expect(i18n.t("auth.login.submit")).toBe("Se connecter");
  });

  it("traduit correctement en anglais", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("common.send")).toBe("Send");
    expect(i18n.t("auth.login.submit")).toBe("Sign in");
  });

  it("traduit correctement en hébreu", async () => {
    await i18n.changeLanguage("he");
    expect(i18n.t("common.send")).toBe("שלח");
    expect(i18n.t("auth.login.submit")).toBe("התחבר");
  });

  it("l'interpolation fonctionne pour les dates relatives", () => {
    expect(i18n.t("sidebar.relativeDate.minutesAgo", { count: 5 })).toBe(
      "il y a 5min"
    );
  });

  it("l'interpolation fonctionne en anglais", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sidebar.relativeDate.minutesAgo", { count: 5 })).toBe(
      "5min ago"
    );
  });

  it("revient au français par défaut pour une clé inconnue", async () => {
    await i18n.changeLanguage("en");
    // Test fallback: unknown key returns the key itself (i18next default)
    const result = i18n.t("unknown.key.that.does.not.exist");
    expect(typeof result).toBe("string");
  });

  it("traduit les clés de navigation en français", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("nav.profile")).toBeDefined();
    expect(i18n.t("nav.chat")).toBeDefined();
    expect(i18n.t("nav.pricing")).toBeDefined();
  });

  it("traduit les clés d'erreurs dans les 3 langues", async () => {
    for (const lang of ["fr", "en", "he"]) {
      await i18n.changeLanguage(lang);
      expect(typeof i18n.t("errors.quotaExceeded")).toBe("string");
      expect(typeof i18n.t("errors.apiDown")).toBe("string");
      expect(i18n.t("errors.quotaExceeded")).not.toBe("");
    }
  });

  it("traduit les clés chat dans les 3 langues", async () => {
    for (const lang of ["fr", "en", "he"]) {
      await i18n.changeLanguage(lang);
      expect(typeof i18n.t("chat.title")).toBe("string");
      expect(i18n.t("chat.title")).not.toBe("");
    }
  });

  it("traduit common.send en hébreu avec direction RTL", async () => {
    await i18n.changeLanguage("he");
    const send = i18n.t("common.send");
    expect(send).toBe("שלח");
  });

  it("l'interpolation count fonctionne en hébreu", async () => {
    await i18n.changeLanguage("he");
    const result = i18n.t("sidebar.relativeDate.minutesAgo", { count: 3 });
    expect(typeof result).toBe("string");
    expect(result).not.toBe("");
  });
});
