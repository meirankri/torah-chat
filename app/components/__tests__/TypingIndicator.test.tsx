import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TypingIndicator } from "../TypingIndicator";

describe("TypingIndicator", () => {
  it("se monte sans erreur", () => {
    const { container } = render(<TypingIndicator />);
    expect(container.firstChild).not.toBeNull();
  });

  it("affiche 3 points d'animation", () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll("span");
    expect(dots).toHaveLength(3);
  });
});
