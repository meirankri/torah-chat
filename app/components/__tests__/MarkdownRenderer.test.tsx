import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownRenderer } from "../MarkdownRenderer.client";

describe("MarkdownRenderer", () => {
  it("se monte sans erreur avec contenu vide", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("se monte sans erreur avec du markdown simple", () => {
    const { container } = render(
      <MarkdownRenderer content="# Titre\n\nParagraphe de test." />
    );
    expect(container.querySelector("h1")).toBeInTheDocument();
  });

  it("rend du texte en gras", () => {
    const { container } = render(
      <MarkdownRenderer content="**texte en gras**" />
    );
    expect(container.querySelector("strong")).toBeInTheDocument();
  });

  it("rend une liste non ordonnée", () => {
    const { container } = render(
      <MarkdownRenderer content="- item 1\n- item 2\n- item 3" />
    );
    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(1);
  });

  it("rend des liens en markdown", () => {
    const { container } = render(
      <MarkdownRenderer content="[Sefaria](https://www.sefaria.org)" />
    );
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://www.sefaria.org");
  });
});
