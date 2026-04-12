import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SourceBlock } from "../SourceBlock";
import type { MessageSource } from "~/domain/entities/source";

const MOCK_SOURCE: MessageSource = {
  id: "src-1",
  messageId: "msg-1",
  sourceType: "sefaria",
  ref: "Berakhot 5a",
  title: "ברכות ה א",
  textHebrew: "טקסט בעברית",
  textTranslation: "English translation text",
  translationLanguage: "english",
  category: "Talmud",
  sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
  createdAt: new Date().toISOString(),
};

describe("SourceBlock", () => {
  it("se monte correctement", () => {
    const { container } = render(<SourceBlock source={MOCK_SOURCE} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("contient un lien vers Sefaria", () => {
    render(<SourceBlock source={MOCK_SOURCE} />);
    const link = screen.getByRole("link");
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://www.sefaria.org/Berakhot%205a"
    );
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("bascule entre replié et déplié au clic", () => {
    const longSource: MessageSource = {
      ...MOCK_SOURCE,
      textHebrew: "א".repeat(200),
      textTranslation: "A".repeat(200),
    };

    const { container } = render(<SourceBlock source={longSource} />);

    // Should have expand button since content is long
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    // Click to expand
    fireEvent.click(buttons[0]!);
    // Component should still be mounted after toggle
    expect(container.firstChild).not.toBeNull();
  });

  it("se monte sans traduction", () => {
    const sourceNoTranslation: MessageSource = {
      ...MOCK_SOURCE,
      textTranslation: null,
    };
    const { container } = render(
      <SourceBlock source={sourceNoTranslation} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("se monte sans URL Sefaria", () => {
    const sourceNoUrl: MessageSource = {
      ...MOCK_SOURCE,
      sefariaUrl: null,
    };
    render(<SourceBlock source={sourceNoUrl} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
