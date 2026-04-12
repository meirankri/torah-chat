import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ChatMessage } from "../ChatMessage";
import type { ChatMessage as ChatMessageType } from "~/domain/entities/chat";

describe("ChatMessage", () => {
  it("se monte avec un message utilisateur", () => {
    const msg: ChatMessageType = {
      id: "1",
      role: "user",
      content: "Test message",
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<ChatMessage message={msg} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("se monte avec un message assistant", () => {
    const msg: ChatMessageType = {
      id: "2",
      role: "assistant",
      content: "Assistant response with **bold**",
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<ChatMessage message={msg} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("rend le markdown pour les messages assistant", () => {
    const msg: ChatMessageType = {
      id: "3",
      role: "assistant",
      content: "Texte avec **gras** et *italique*",
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<ChatMessage message={msg} />);
    // Le markdown rend du HTML avec des balises strong/em
    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("em")).not.toBeNull();
  });

  it("affiche le texte brut pour les messages utilisateur", () => {
    const msg: ChatMessageType = {
      id: "4",
      role: "user",
      content: "Simple text",
      createdAt: new Date().toISOString(),
    };
    const { container } = render(<ChatMessage message={msg} />);
    expect(container.querySelector("p")).not.toBeNull();
    // Pas de rendu markdown pour l'utilisateur
    expect(container.querySelector(".prose")).toBeNull();
  });
});
