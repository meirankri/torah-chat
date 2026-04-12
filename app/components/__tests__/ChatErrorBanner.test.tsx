import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChatErrorBanner } from "../ChatErrorBanner";
import type { ChatError } from "~/domain/entities/chat";

describe("ChatErrorBanner", () => {
  it("se monte et affiche le message d'erreur", () => {
    const error: ChatError = { code: "TIMEOUT", message: "La réponse prend trop de temps." };
    const onDismiss = vi.fn();
    const { container } = render(
      <ChatErrorBanner error={error} onDismiss={onDismiss} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("appelle onDismiss quand on clique le bouton fermer", async () => {
    const user = userEvent.setup();
    const error: ChatError = { code: "API_DOWN", message: "Service indisponible." };
    const onDismiss = vi.fn();
    render(<ChatErrorBanner error={error} onDismiss={onDismiss} />);

    const closeButton = screen.getByRole("button", { name: /fermer/i });
    await user.click(closeButton);

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
