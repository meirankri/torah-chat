import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiClient, chatHistoryToGemini } from "../gemini-client";

// ─── chatHistoryToGemini ──────────────────────────────────────────────────────

describe("chatHistoryToGemini", () => {
  it("convertit les messages assistant en 'model'", () => {
    const history = [
      { role: "user" as const, content: "Shalom" },
      { role: "assistant" as const, content: "Shalom !" },
    ];
    const result = chatHistoryToGemini(history);
    expect(result[0]).toEqual({ role: "user", parts: [{ text: "Shalom" }] });
    expect(result[1]).toEqual({ role: "model", parts: [{ text: "Shalom !" }] });
  });

  it("retourne un tableau vide si l'historique est vide", () => {
    expect(chatHistoryToGemini([])).toEqual([]);
  });

  it("conserve l'ordre des messages", () => {
    const history = [
      { role: "user" as const, content: "Q1" },
      { role: "assistant" as const, content: "A1" },
      { role: "user" as const, content: "Q2" },
      { role: "assistant" as const, content: "A2" },
    ];
    const result = chatHistoryToGemini(history);
    expect(result).toHaveLength(4);
    expect(result[0]?.role).toBe("user");
    expect(result[1]?.role).toBe("model");
    expect(result[2]?.role).toBe("user");
    expect(result[3]?.role).toBe("model");
  });
});

// ─── GeminiClient.extractSearchQueries ───────────────────────────────────────

describe("GeminiClient.extractSearchQueries", () => {
  const mockFetch = vi.fn();
  let client: GeminiClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new GeminiClient("test-api-key");
  });

  function makeGeminiResponse(text: string) {
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }], role: "model" }, finishReason: "STOP" }],
      }),
    };
  }

  it("retourne les queries et refs du JSON Gemini", async () => {
    mockFetch.mockResolvedValue(
      makeGeminiResponse('{"queries": ["shabbat laws", "melakhot"], "refs": ["Shabbat"]}')
    );
    const result = await client.extractSearchQueries("Peut-on allumer une lumière le shabbat ?");
    expect(result.queries).toEqual(["shabbat laws", "melakhot"]);
    expect(result.refs).toEqual(["Shabbat"]);
  });

  it("parse le JSON même dans un bloc markdown", async () => {
    mockFetch.mockResolvedValue(
      makeGeminiResponse('```json\n{"queries": ["teshuva repentance"], "refs": []}\n```')
    );
    const result = await client.extractSearchQueries("Qu'est-ce que la techouva ?");
    expect(result.queries).toEqual(["teshuva repentance"]);
    expect(result.refs).toEqual([]);
  });

  it("retourne queries/refs vides si la réponse API échoue", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "error" });
    const result = await client.extractSearchQueries("Question");
    expect(result.queries).toEqual([]);
    expect(result.refs).toEqual([]);
  });

  it("retourne queries/refs vides si le JSON est invalide", async () => {
    mockFetch.mockResolvedValue(makeGeminiResponse("Voici ma réponse en texte libre."));
    const result = await client.extractSearchQueries("Question");
    expect(result.queries).toEqual([]);
    expect(result.refs).toEqual([]);
  });

  it("retourne queries/refs vides si les candidates sont absents", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    const result = await client.extractSearchQueries("Question");
    expect(result.queries).toEqual([]);
    expect(result.refs).toEqual([]);
  });

  it("utilise des tableaux vides pour les champs manquants", async () => {
    mockFetch.mockResolvedValue(
      makeGeminiResponse('{"queries": ["kibbud av vaem"]}') // pas de refs
    );
    const result = await client.extractSearchQueries("Honorer ses parents");
    expect(result.queries).toEqual(["kibbud av vaem"]);
    expect(result.refs).toEqual([]);
  });
});

// ─── GeminiClient.chat ────────────────────────────────────────────────────────

describe("GeminiClient.chat", () => {
  const mockFetch = vi.fn();
  let client: GeminiClient;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    client = new GeminiClient("test-api-key");
  });

  it("retourne le texte de la réponse Gemini", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "Le Shabbat est le septième jour." }], role: "model" }, finishReason: "STOP" }],
      }),
    });
    const result = await client.chat("System prompt", [], "Qu'est-ce que le Shabbat ?");
    expect(result).toBe("Le Shabbat est le septième jour.");
  });

  it("lève GEMINI_OVERLOADED sur 503", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503, text: async () => "overloaded" });
    await expect(client.chat("sys", [], "question")).rejects.toThrow("GEMINI_OVERLOADED");
  });

  it("lève GEMINI_OVERLOADED sur 429", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });
    await expect(client.chat("sys", [], "question")).rejects.toThrow("GEMINI_OVERLOADED");
  });

  it("lève une erreur générique sur autre code d'erreur", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" });
    await expect(client.chat("sys", [], "question")).rejects.toThrow("Gemini API error: 400");
  });

  it("retourne une chaîne vide si candidates est vide", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    const result = await client.chat("sys", [], "question");
    expect(result).toBe("");
  });
});
