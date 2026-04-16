import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  embedQueryGemini,
  queryVectorizeSefaria,
  fetchSefariaChunks,
  retrieveSefariaRagSources,
  buildSefariaRagContext,
} from "../sefaria-rag-service";

describe("SefariaRagService", () => {
  describe("embedQueryGemini", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("retourne un vecteur 1536 depuis la réponse Gemini", async () => {
      const fakeVector = Array.from({ length: 1536 }, (_, i) => i / 1536);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ embedding: { values: fakeVector } }), { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await embedQueryGemini("fake-key", "question test");
      expect(res).toEqual(fakeVector);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toContain("gemini-embedding-001");
      expect(init.body).toContain("RETRIEVAL_QUERY");
      expect(init.body).toContain("\"outputDimensionality\":1536");
    });

    it("lève une erreur si Gemini renvoie 4xx", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }))
      );
      await expect(embedQueryGemini("key", "q")).rejects.toThrow(/Gemini embed query 400/);
    });
  });

  describe("queryVectorizeSefaria", () => {
    it("propage les matches retournés par Vectorize", async () => {
      const matches = [
        { id: "a", score: 0.8, metadata: { ref: "Genesis 1:1", book: "Genesis" } },
        { id: "b", score: 0.6, metadata: { ref: "Genesis 1:2", book: "Genesis" } },
      ];
      const vectorize = { query: vi.fn().mockResolvedValue({ matches }) };
      const out = await queryVectorizeSefaria(vectorize, [0.1, 0.2], 5);
      expect(out).toEqual(matches);
      expect(vectorize.query).toHaveBeenCalledWith([0.1, 0.2], { topK: 5, returnMetadata: "all" });
    });

    it("renvoie un tableau vide si Vectorize ne retourne pas de matches", async () => {
      const vectorize = { query: vi.fn().mockResolvedValue({ matches: undefined }) };
      const out = await queryVectorizeSefaria(vectorize, [0.1], 3);
      expect(out).toEqual([]);
    });
  });

  describe("fetchSefariaChunks", () => {
    it("retourne une Map vide si ids est vide", async () => {
      const db = { prepare: vi.fn() } as unknown as D1Database;
      const m = await fetchSefariaChunks(db, []);
      expect(m.size).toBe(0);
    });

    it("construit la query SELECT avec les bons placeholders", async () => {
      const results = [
        { id: "a", ref: "Genesis 1:1", book: "Genesis", category: "Tanakh", he: "he", en: "en", fr: null, commentary_on: null },
      ];
      const all = vi.fn().mockResolvedValue({ results });
      const bind = vi.fn().mockReturnValue({ all });
      const prepare = vi.fn().mockReturnValue({ bind });
      const db = { prepare } as unknown as D1Database;

      const m = await fetchSefariaChunks(db, ["a", "b"]);
      expect(prepare).toHaveBeenCalledWith(expect.stringContaining("IN (?, ?)"));
      expect(bind).toHaveBeenCalledWith("a", "b");
      expect(m.get("a")?.ref).toBe("Genesis 1:1");
    });
  });

  describe("retrieveSefariaRagSources", () => {
    it("retourne [] si Vectorize est null", async () => {
      const db = { prepare: vi.fn() } as unknown as D1Database;
      const out = await retrieveSefariaRagSources("k", null, db, "q");
      expect(out).toEqual([]);
    });

    it("filtre les matches sous minScore", async () => {
      const fakeVector = Array.from({ length: 1536 }, () => 0);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ embedding: { values: fakeVector } }), { status: 200 })
        )
      );
      const vectorize = {
        query: vi.fn().mockResolvedValue({
          matches: [
            { id: "a", score: 0.7, metadata: { ref: "R1" } },
            { id: "b", score: 0.4, metadata: { ref: "R2" } }, // sous le seuil
          ],
        }),
      };
      const all = vi.fn().mockResolvedValue({
        results: [
          { id: "a", ref: "R1", book: "B", category: "C", he: "h", en: null, fr: null, commentary_on: null },
        ],
      });
      const db = {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ all }) }),
      } as unknown as D1Database;

      const out = await retrieveSefariaRagSources("k", vectorize, db, "q", 5, 0.5);
      expect(out).toHaveLength(1);
      expect(out[0]?.id).toBe("a");
      expect(out[0]?.score).toBe(0.7);
    });

    it("catch les erreurs Gemini et renvoie []", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("x", { status: 500 }))
      );
      const vectorize = { query: vi.fn() };
      const db = { prepare: vi.fn() } as unknown as D1Database;
      const out = await retrieveSefariaRagSources("k", vectorize, db, "q");
      expect(out).toEqual([]);
      expect(vectorize.query).not.toHaveBeenCalled();
    });
  });

  describe("buildSefariaRagContext", () => {
    it("retourne '' si aucune source", () => {
      expect(buildSefariaRagContext([])).toBe("");
    });

    it("formate les sources avec leur ref, texte HE et traduction", () => {
      const out = buildSefariaRagContext([
        {
          id: "1",
          ref: "Genesis 1:1",
          book: "Genesis",
          category: "Tanakh",
          he: "בראשית",
          en: "In the beginning",
          fr: "Au commencement",
          commentary_on: null,
          score: 0.8,
        },
      ]);
      expect(out).toContain("Genesis 1:1");
      expect(out).toContain("בראשית");
      // Le formateur privilégie la trad FR si dispo
      expect(out).toContain("Au commencement");
    });

    it("fallback sur l'anglais si pas de FR", () => {
      const out = buildSefariaRagContext([
        {
          id: "1",
          ref: "Genesis 1:1",
          book: "Genesis",
          category: "Tanakh",
          he: "בראשית",
          en: "In the beginning",
          fr: null,
          commentary_on: null,
          score: 0.8,
        },
      ]);
      expect(out).toContain("In the beginning");
    });

    it("indique commentary_on si présent", () => {
      const out = buildSefariaRagContext([
        {
          id: "1",
          ref: "Rashi on Genesis 1:1",
          book: "Rashi on Genesis",
          category: "Tanakh Commentary",
          he: "אמר רבי יצחק",
          en: null,
          fr: null,
          commentary_on: "Genesis 1:1",
          score: 0.75,
        },
      ]);
      expect(out).toContain("commentaire sur Genesis 1:1");
    });
  });
});
