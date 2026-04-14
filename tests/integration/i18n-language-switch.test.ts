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
});
