import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChat } from "../use-chat";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("useChat", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("initialise avec un état vide", () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("refuse un message trop long", async () => {
    const { result } = renderHook(() => useChat());
    const longMessage = "a".repeat(MAX_INPUT_LENGTH + 1);

    await act(async () => {
      await result.current.sendMessage(longMessage);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe("INPUT_TOO_LONG");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refuse un message vide", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("ajoute un message utilisateur et assistant lors d'un envoi", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ response: "Shalom", sources: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Bonjour");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.role).toBe("user");
    expect(result.current.messages[0]?.content).toBe("Bonjour");
    expect(result.current.messages[1]?.role).toBe("assistant");
    expect(result.current.messages[1]?.content).toBe("Shalom");
  });

  it("gère les erreurs API", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "API_DOWN", message: "Service unavailable" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Test");
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.code).toBe("API_DOWN");
    // L'assistant message vide devrait être retiré
    expect(result.current.messages).toHaveLength(1); // Seulement le message user
  });

  it("clearError efface l'erreur", async () => {
    const { result } = renderHook(() => useChat());
    const longMessage = "a".repeat(MAX_INPUT_LENGTH + 1);

    await act(async () => {
      await result.current.sendMessage(longMessage);
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("clearMessages vide tous les messages", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ response: "OK", sources: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Test");
    });

    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it("stopGeneration met isLoading à false", async () => {
    const { result } = renderHook(() => useChat());

    // stopGeneration ne plante pas même si aucune requête en cours
    act(() => {
      result.current.stopGeneration();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("regenerateLastResponse ne fait rien si pas de message précédent", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateLastResponse();
    });

    // Aucun fetch déclenché (pas de message précédent)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("regenerateLastResponse renvoie le dernier message utilisateur", async () => {
    // First send a message
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ response: "Première réponse", sources: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    // Then regenerate
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ response: "Réponse régénérée", sources: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Quelle est la signification de Shabbat ?");
    });

    const messagesAfterFirst = result.current.messages.length;
    expect(messagesAfterFirst).toBeGreaterThan(0);

    await act(async () => {
      await result.current.regenerateLastResponse();
    });

    // Should have called fetch twice
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
