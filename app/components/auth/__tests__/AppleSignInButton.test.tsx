import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppleSignInButton } from "../AppleSignInButton";

describe("AppleSignInButton", () => {
  it("se monte et affiche le lien vers /api/auth/apple", () => {
    render(<AppleSignInButton />);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/auth/apple");
  });

  it("accepte un label custom", () => {
    render(<AppleSignInButton label="Continuer avec Apple" />);
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.getByText("Continuer avec Apple")).toBeInTheDocument();
  });

  it("affiche le SVG du logo Apple", () => {
    render(<AppleSignInButton />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
