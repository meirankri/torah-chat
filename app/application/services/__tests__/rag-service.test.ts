import { describe, it, expect, vi } from "vitest";
import { chunkText, generateEmbedding, retrieveCustomSources, queryVectorize, fetchCustomChunks, DEFAULT_EMBEDDING_MODEL } from "../rag-service";

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
        DEFAULT_EMBEDDING_MODEL,
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

  describe("queryVectorize", () => {
    it("retourne les matches Vectorize", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({ data: [[0.1, 0.2, 0.3]] }),
      };
      const mockVectorize = {
        query: vi.fn().mockResolvedValueOnce({
          matches: [
            { id: "chunk-1", score: 0.95 },
            { id: "chunk-2", score: 0.87 },
          ],
        }),
      };

      const result = await queryVectorize(
        mockVectorize as Parameters<typeof queryVectorize>[0],
        mockAi as Parameters<typeof queryVectorize>[1],
        "question Torah"
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("chunk-1");
      expect(mockVectorize.query).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3],
        { topK: 3, returnMetadata: "none" }
      );
    });

    it("retourne [] si Vectorize ne retourne aucun match", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({ data: [[0.1, 0.2]] }),
      };
      const mockVectorize = {
        query: vi.fn().mockResolvedValueOnce({ matches: undefined }),
      };

      const result = await queryVectorize(
        mockVectorize as Parameters<typeof queryVectorize>[0],
        mockAi as Parameters<typeof queryVectorize>[1],
        "question"
      );

      expect(result).toEqual([]);
    });

    it("utilise le topK spécifié", async () => {
      const mockAi = {
        run: vi.fn().mockResolvedValueOnce({ data: [[0.5]] }),
      };
      const mockVectorize = {
        query: vi.fn().mockResolvedValueOnce({ matches: [] }),
      };

      await queryVectorize(
        mockVectorize as Parameters<typeof queryVectorize>[0],
        mockAi as Parameters<typeof queryVectorize>[1],
        "question",
        10
      );

      expect(mockVectorize.query).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ topK: 10 })
      );
    });
  });

  describe("fetchCustomChunks", () => {
    it("retourne [] si vectorizeIds est vide", async () => {
      const mockDb = { prepare: vi.fn() } as unknown as D1Database;
      const result = await fetchCustomChunks(mockDb, []);
      expect(result).toEqual([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("retourne les CustomSources depuis D1", async () => {
      const mockRows = [
        { id: "c1", title: "Rambam", author: "Maïmonide", category: "Halakha", content: "Texte 1", chunk_index: 0 },
        { id: "c2", title: "Torah", author: null, category: "Torah", content: "Texte 2", chunk_index: 1 },
      ];
      const mockBind = vi.fn().mockReturnThis();
      const mockAll = vi.fn().mockResolvedValueOnce({ results: mockRows });
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind, all: mockAll }),
      } as unknown as D1Database;

      const result = await fetchCustomChunks(mockDb, ["vec-1", "vec-2"]);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("c1");
      expect(result[0]?.title).toBe("Rambam");
      expect(result[0]?.author).toBe("Maïmonide");
      expect(result[0]?.chunkIndex).toBe(0);
      expect(result[1]?.author).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("custom_texts WHERE vectorize_id IN")
      );
    });
  });
});
