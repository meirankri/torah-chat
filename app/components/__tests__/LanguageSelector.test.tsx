import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LanguageSelector } from "../LanguageSelector";

describe("LanguageSelector", () => {
  it("se monte correctement", () => {
    const { container } = render(<LanguageSelector />);
    expect(container.querySelector("select")).not.toBeNull();
  });

  it("affiche les 3 options de langue", () => {
    render(<LanguageSelector />);
    const select = screen.getByRole("combobox");
    const options = select.querySelectorAll("option");
    expect(options).toHaveLength(3);
  });

  it("la langue initiale est fr", () => {
    render(<LanguageSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("fr");
  });

  it("change la valeur sélectionnée", () => {
    render(<LanguageSelector />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "en" } });
    expect(select.value).toBe("en");
  });
});
