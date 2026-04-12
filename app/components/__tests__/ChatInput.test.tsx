import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChatInput } from "../ChatInput";

describe("ChatInput", () => {
  it("se monte sans erreur", () => {
    const onSend = vi.fn();
    const { container } = render(<ChatInput onSend={onSend} disabled={false} />);
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("appelle onSend quand on clique le bouton envoyer", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Ma question");

    const button = screen.getByRole("button", { name: /envoyer/i });
    await user.click(button);

    expect(onSend).toHaveBeenCalledWith("Ma question");
  });

  it("appelle onSend quand on appuie sur Entrée", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Ma question{Enter}");

    expect(onSend).toHaveBeenCalledWith("Ma question");
  });

  it("ne permet pas l'envoi quand disabled", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();

    const button = screen.getByRole("button", { name: /envoyer/i });
    expect(button).toBeDisabled();
  });

  it("ne permet pas l'envoi d'un message vide", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const button = screen.getByRole("button", { name: /envoyer/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("vide le textarea après envoi", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Test");

    const button = screen.getByRole("button", { name: /envoyer/i });
    await user.click(button);

    expect(textarea).toHaveValue("");
  });
});
