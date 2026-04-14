import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QuotaWarningBanner } from "../QuotaWarningBanner";

// i18n minimal mock
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: "en",
    resources: {
      en: {
        translation: {
          "chat.quotaWarning": "You have {{remaining}} questions left this month.",
          "chat.quotaWarningUpgrade": "Upgrade plan",
        },
      },
    },
    interpolation: { escapeValue: false },
  });
}

function renderBanner(used: number, limit: number) {
  return render(
    <MemoryRouter>
      <QuotaWarningBanner used={used} limit={limit} />
    </MemoryRouter>
  );
}

describe("QuotaWarningBanner", () => {
  it("ne s'affiche pas en dessous de 80% d'utilisation", () => {
    const { container } = renderBanner(79, 100);
    expect(container.firstChild).toBeNull();
  });

  it("ne s'affiche pas à 0%", () => {
    const { container } = renderBanner(0, 500);
    expect(container.firstChild).toBeNull();
  });

  it("s'affiche exactement à 80% d'utilisation", () => {
    const { container } = renderBanner(80, 100);
    expect(container.firstChild).not.toBeNull();
  });

  it("s'affiche au-delà de 80%", () => {
    const { container } = renderBanner(90, 100);
    expect(container.firstChild).not.toBeNull();
  });

  it("s'affiche à 100%", () => {
    const { container } = renderBanner(100, 100);
    expect(container.firstChild).not.toBeNull();
  });

  it("affiche le nombre de questions restantes", () => {
    const { getByText } = renderBanner(450, 500);
    expect(getByText(/50/)).toBeTruthy();
  });

  it("contient un lien vers /pricing", () => {
    const { container } = renderBanner(400, 500);
    const link = container.querySelector("a[href='/pricing']");
    expect(link).not.toBeNull();
  });
});
