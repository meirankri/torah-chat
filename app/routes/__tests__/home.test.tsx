import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "../home";

describe("Home", () => {
  it("se monte sans erreur", () => {
    const { container } = render(<Home />);
    expect(container.querySelector("main")).not.toBeNull();
  });
});
