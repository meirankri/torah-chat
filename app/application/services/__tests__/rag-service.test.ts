import { describe, it, expect, vi } from "vitest";
import { chunkText, generateEmbedding, retrieveCustomSources } from "../rag-service";

describe("RAG Service", () => {
  describe("chunkText", () => {
    it("retourne un tableau vide pour une chaîne vide", () => {
      expect(chunkText("")).toEqual([]);
    });

    it("retourne un seul chunk si le texte est plus court que la cible", () => {
      const text = "Bonjour le monde ceci est un texte court";
      const chunks = chunkText(text, 200, 50);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("découpe un texte long en plusieurs chunks", () => {
      // 500 mots
      const words = Array.from({ length: 500 }, (_, i) => `mot${i}`);
      const text = words.join(" ");
      const chunks = chunkText(text, 200, 50);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("les chunks se chevauchent (overlap)", () => {
      const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
      const text = words.join(" ");
      const chunks = chunkText(text, 100, 30);
      // Le deuxième chunk doit commencer avec des mots du premier (overlap)
      const firstChunkWords = (chunks[0] ?? "").split(" ");
      const secondChunkWords = (chunks[1] ?? "").split(" ");
      // Les 30 derniers mots du premier chunk devraient être au début du second
      const overlapWords = firstChunkWords.slice(-30);
      const secondStart = secondChunkWords.slice(0, 30);
      expect(overlapWords).toEqual(secondStart);
    });

    it("chaque chunk contient au maximum targetWords mots", () => {
      const words = Array.from({ length: 500 }, (_, i) => `word${i}`);
      const text = words.join(" ");
      const target = 100;
      const chunks = chunkText(text, target, 20);
      for (const chunk of chunks) {
        const wordCount = chunk.split(" ").length;
        expect(wordCount).toBeLessThanOrEqual(target);
      }
    });

    it("reconstitue approximativement le texte d'origine (premier et dernier mots)", () => {
      const words = Array.from({ length: 400 }, (_, i) => `word${i}`);
      const text = words.join(" ");
      const chunks = chunkText(text, 150, 50);
      // Le premier chunk commence par le premier mot
      expect(chunks[0]!.startsWith("word0")).toBe(true);
      // Le dernier chunk se termine par le dernier mot
      expect(chunks[chunks.length - 1]!.endsWith("word399")).toBe(true);
    });
  });

  describe("generateEmbedding", () => {
    it("appelle Workers AI avec le bon modèle et texte", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({
          data: [[0.1, 0.2, 0.3, 0.4]],
        }),
      };

      const result = await generateEmbedding(mockAi as Parameters<typeof generateEmbedding>[0], "Test question");
      expect(mockAi.run).toHaveBeenCalledWith(
        "@cf/baai/bge-base-en-v1.5",
        { text: ["Test question"] }
      );
      expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
    });

    it("lève une erreur si aucun embedding retourné", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({ data: [] }),
      };

      await expect(
        generateEmbedding(mockAi as Parameters<typeof generateEmbedding>[0], "test")
      ).rejects.toThrow("No embedding returned");
    });
  });

  describe("retrieveCustomSources", () => {
    it("retourne [] si Vectorize n'est pas configuré", async () => {
      const mockAi = { run: vi.fn() };
      const mockDb = {} as D1Database;
      const result = await retrieveCustomSources(
        mockAi as Parameters<typeof retrieveCustomSources>[0],
        null,
        mockDb,
        "test question"
      );
      expect(result).toEqual([]);
      expect(mockAi.run).not.toHaveBeenCalled();
    });

    it("retourne [] si Vectorize ne trouve aucun match", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({ data: [[0.1, 0.2]] }),
      };
      const mockVectorize = {
        query: vi.fn().mockResolvedValueOnce({ matches: [] }),
      };
      const mockDb = {} as D1Database;

      const result = await retrieveCustomSources(
        mockAi as Parameters<typeof retrieveCustomSources>[0],
        mockVectorize as Parameters<typeof retrieveCustomSources>[1],
        mockDb,
        "test question"
      );
      expect(result).toEqual([]);
    });
  });
});
