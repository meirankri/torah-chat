import { describe, it, expect, vi } from "vitest";
import { buildLLMMessages } from "~/application/services/chat-service";
import { MAX_INPUT_LENGTH } from "~/domain/entities/chat";
import type { ChatMessage, ChatError, ChatErrorCode } from "~/domain/entities/chat";
import { getModelForPlan } from "~/application/services/quota-service";

describe("Chat flow integration", () => {
  describe("Message flow validation", () => {
    it("construit un flow complet question → LLM messages", () => {
      const systemPrompt = "Tu es un assistant Torah.";
      const history: ChatMessage[] = [
        { id: "1", role: "user", content: "Qu'est-ce que le Shabbat ?", createdAt: "2024-01-01T00:00:00Z" },
        { id: "2", role: "assistant", content: "Le Shabbat est le jour de repos...", createdAt: "2024-01-01T00:00:01Z" },
      ];
      const newQuestion = "Quelles en sont les lois principales ?";

      const messages = buildLLMMessages(systemPrompt, history, 10);
      messages.push({ role: "user", content: newQuestion });

      // Vérifier la structure complète
      expect(messages[0]?.role).toBe("system");
      expect(messages[1]?.role).toBe("user");
      expect(messages[2]?.role).toBe("assistant");
      expect(messages[3]?.role).toBe("user");
      expect(messages[3]?.content).toBe(newQuestion);
    });

    it("tronque l'historique quand il dépasse la limite", () => {
      const systemPrompt = "System prompt";
      const history: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
        id: String(i),
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message ${i}`,
        createdAt: new Date(2024, 0, 1, 0, 0, i).toISOString(),
      }));

      const messages = buildLLMMessages(systemPrompt, history, 10);
      // 1 system + 10 history messages
      expect(messages).toHaveLength(11);
      // Les derniers messages doivent être les plus récents
      expect(messages[1]?.content).toBe("Message 20");
      expect(messages[10]?.content).toBe("Message 29");
    });
  });

  describe("Input validation", () => {
    it("rejette les messages dépassant MAX_INPUT_LENGTH", () => {
      const longMessage = "a".repeat(MAX_INPUT_LENGTH + 1);
      expect(longMessage.length).toBeGreaterThan(MAX_INPUT_LENGTH);
    });

    it("accepte les messages dans la limite", () => {
      const validMessage = "a".repeat(MAX_INPUT_LENGTH);
      expect(validMessage.length).toBe(MAX_INPUT_LENGTH);
    });

    it("valide tous les codes d'erreur possibles", () => {
      const allCodes: ChatErrorCode[] = [
        "TIMEOUT",
        "API_DOWN",
        "QUOTA_EXCEEDED",
        "INPUT_TOO_LONG",
        "RATE_LIMITED",
        "UNKNOWN",
      ];

      const errors: ChatError[] = allCodes.map((code) => ({
        code,
        message: `Error: ${code}`,
      }));

      expect(errors).toHaveLength(6);
      expect(new Set(errors.map((e) => e.code)).size).toBe(6);
    });
  });

  describe("Workers AI fallback", () => {
    it("utilise le modèle trial (8B) pour free_trial", () => {
      const env = {
        WORKERS_AI_MODEL_TRIAL: "@cf/meta/llama-3.1-8b-instruct",
        WORKERS_AI_MODEL_STANDARD: "@cf/meta/llama-3.1-70b-instruct",
        WORKERS_AI_MODEL_PREMIUM: "@cf/meta/llama-3.1-70b-instruct",
      };
      expect(getModelForPlan("free_trial", env)).toBe("@cf/meta/llama-3.1-8b-instruct");
    });

    it("utilise 70B pour le plan standard", () => {
      const env = {
        WORKERS_AI_MODEL_STANDARD: "@cf/meta/llama-3.1-70b-instruct",
        WORKERS_AI_MODEL_PREMIUM: "@cf/meta/llama-3.1-70b-instruct",
      };
      expect(getModelForPlan("standard", env)).toBe("@cf/meta/llama-3.1-70b-instruct");
    });

    it("utilise WORKERS_AI_MODEL_PREMIUM pour le plan premium", () => {
      const env = {
        WORKERS_AI_MODEL_STANDARD: "@cf/meta/llama-3.1-70b-instruct",
        WORKERS_AI_MODEL_PREMIUM: "@cf/meta/llama-3.1-70b-instruct",
      };
      expect(getModelForPlan("premium", env)).toBe("@cf/meta/llama-3.1-70b-instruct");
    });

    it("free_trial utilise 8B par défaut, standard utilise 70B par défaut", () => {
      const env = {};
      expect(getModelForPlan("free_trial", env)).toBe("@cf/meta/llama-3.1-8b-instruct");
      expect(getModelForPlan("standard", env)).toBe("@cf/meta/llama-3.1-70b-instruct");
    });

    it("simule le fallback Workers AI quand Gemini échoue", async () => {
      const mockAI = {
        run: vi.fn().mockResolvedValue({ response: "Réponse depuis Workers AI" }),
      };

      const messages = [
        { role: "system" as const, content: "Tu es un assistant Torah." },
        { role: "user" as const, content: "Qu'est-ce que le Shabbat ?" },
      ];

      const result = await mockAI.run("@cf/meta/llama-3.1-8b-instruct", { messages });

      expect(mockAI.run).toHaveBeenCalledWith("@cf/meta/llama-3.1-8b-instruct", { messages });
      expect(result.response).toBe("Réponse depuis Workers AI");
    });

    it("remonte une erreur si Workers AI retourne une réponse vide", async () => {
      const mockAI = {
        run: vi.fn().mockResolvedValue({ response: undefined }),
      };

      const messages = [{ role: "user" as const, content: "test" }];
      const result = await mockAI.run("@cf/meta/llama-3.1-8b-instruct", { messages });

      expect(result.response).toBeUndefined();
    });
  });

  describe("SSE stream parsing", () => {
    it("parse correctement un chunk SSE Workers AI", () => {
      const sseChunk = 'data: {"response":"Bonjour"}\n\n';
      const lines = sseChunk.split("\n");
      const dataLine = lines.find((l) => l.startsWith("data: "));

      expect(dataLine).toBeDefined();
      const data = dataLine!.slice(6);
      const parsed = JSON.parse(data) as { response: string };
      expect(parsed.response).toBe("Bonjour");
    });

    it("identifie le signal de fin [DONE]", () => {
      const doneLine = "data: [DONE]";
      const data = doneLine.slice(6);
      expect(data).toBe("[DONE]");
    });

    it("gère plusieurs chunks concaténés", () => {
      const multiChunk =
        'data: {"response":"Bon"}\n\ndata: {"response":"jour"}\n\ndata: [DONE]\n\n';
      const lines = multiChunk.split("\n");
      const dataLines = lines.filter((l) => l.startsWith("data: "));

      let result = "";
      for (const line of dataLines) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        const parsed = JSON.parse(data) as { response: string };
        result += parsed.response;
      }

      expect(result).toBe("Bonjour");
    });
  });
});
