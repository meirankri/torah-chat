import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GoogleSignInButton } from "../GoogleSignInButton";

describe("GoogleSignInButton", () => {
  it("se monte et affiche le lien", () => {
    render(<GoogleSignInButton />);

    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/auth/google");
  });

  it("accepte un label custom", () => {
    render(<GoogleSignInButton label="Sign in with Google" />);

    expect(screen.getByRole("link")).toBeInTheDocument();
  });
});
