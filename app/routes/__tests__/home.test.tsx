import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "../home";

describe("Home", () => {
  it("se monte sans erreur (redirige, donc rend null)", () => {
    const { container } = render(<Home />);
    // Home rend null car le loader redirige vers /login ou /chat
    expect(container).toBeDefined();
  });
});
