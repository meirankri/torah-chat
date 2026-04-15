import { describe, it, expect, vi, beforeEach } from "vitest";
import { SefariaClient } from "../sefaria-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

describe("SefariaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findRefs", () => {
    it("extrait les refs d'un texte via l'API Sefaria", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ refs: ["Berakhot 5a", "Shabbat 31a"] }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const refs = await client.findRefs("Le Talmud dit dans Berakhot 5a...");

      expect(refs).toEqual(["Berakhot 5a", "Shabbat 31a"]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.sefaria.org/api/find-refs",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        })
      );
    });

    it("retourne un tableau vide si l'API échoue", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const refs = await client.findRefs("Some text");

      expect(refs).toEqual([]);
    });

    it("retourne un tableau vide si la réponse n'a pas de refs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const refs = await client.findRefs("Some text");

      expect(refs).toEqual([]);
    });

    it("déduplique les refs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          refs: ["Berakhot 5a", "Berakhot 5a", "Shabbat 31a"],
        }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const refs = await client.findRefs("text");

      expect(refs).toEqual(["Berakhot 5a", "Shabbat 31a"]);
    });

    it("retourne un tableau vide en cas d'erreur réseau", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const refs = await client.findRefs("text");

      expect(refs).toEqual([]);
    });
  });

  describe("getText", () => {
    it("récupère le texte hébreu et la traduction d'une ref", async () => {
      // Hebrew fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "Berakhot 5a",
          heRef: "ברכות ה א",
          versions: [
            { text: "<b>Hebrew text</b>", language: "he", versionTitle: "v1" },
          ],
          categories: ["Talmud"],
        }),
      });
      // Translation fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "Berakhot 5a",
          heRef: "ברכות ה א",
          versions: [
            { text: "English translation", language: "en", versionTitle: "v2" },
          ],
          categories: ["Talmud"],
        }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.getText("Berakhot 5a");

      expect(result).not.toBeNull();
      expect(result!.ref).toBe("Berakhot 5a");
      expect(result!.textHebrew).toBe("Hebrew text");
      expect(result!.textTranslation).toBe("English translation");
      expect(result!.category).toBe("Talmud");
    });

    it("retourne null si le fetch échoue", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.getText("Invalid.Ref");

      expect(result).toBeNull();
    });

    it("utilise le cache KV si disponible", async () => {
      const cached = {
        ref: "Berakhot 5a",
        heRef: "ברכות ה א",
        textHebrew: "Cached hebrew",
        textTranslation: "Cached translation",
        translationLanguage: "english",
        category: "Talmud",
        sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
      };

      const kv = createMockKV();
      (kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        JSON.stringify(cached)
      );

      const client = new SefariaClient("https://www.sefaria.org", kv, 86400);
      const result = await client.getText("Berakhot 5a");

      expect(result).toEqual(cached);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("met en cache le résultat dans KV", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "Shabbat 31a",
          heRef: "שבת לא א",
          versions: [
            { text: "Hebrew", language: "he", versionTitle: "v1" },
          ],
          categories: ["Talmud"],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "Shabbat 31a",
          heRef: "שבת לא א",
          versions: [
            { text: "English", language: "en", versionTitle: "v2" },
          ],
          categories: ["Talmud"],
        }),
      });

      const kv = createMockKV();
      (kv.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const client = new SefariaClient("https://www.sefaria.org", kv, 86400);
      await client.getText("Shabbat 31a");

      expect(kv.put).toHaveBeenCalledWith(
        "sefaria:Shabbat 31a:english",
        expect.any(String),
        { expirationTtl: 86400 }
      );
    });

    it("gère les textes en tableau (nested arrays)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ref: "Genesis 1",
          heRef: "בראשית א",
          versions: [
            {
              text: ["<b>Part 1</b>", "<i>Part 2</i>"],
              language: "he",
              versionTitle: "v1",
            },
          ],
          categories: ["Tanakh", "Torah"],
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.getText("Genesis 1");

      expect(result).not.toBeNull();
      expect(result!.textHebrew).toBe("Part 1 Part 2");
      expect(result!.textTranslation).toBeNull();
    });
  });

  describe("getSourcesForText", () => {
    it("retourne un tableau vide si aucune ref trouvée", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ refs: [] }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const sources = await client.getSourcesForText("No refs here");

      expect(sources).toEqual([]);
    });

    it("limite le nombre de sources", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          refs: ["Ref1", "Ref2", "Ref3", "Ref4", "Ref5", "Ref6"],
        }),
      });

      // Mock getText for each limited ref (5 max) - 2 fetches per ref (hebrew + translation)
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ref: `Ref${i + 1}`,
            heRef: `רף ${i + 1}`,
            versions: [
              { text: `Hebrew ${i}`, language: "he", versionTitle: "v1" },
            ],
            categories: ["Talmud"],
          }),
        });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ref: `Ref${i + 1}`,
            heRef: `רף ${i + 1}`,
            versions: [
              { text: `English ${i}`, language: "en", versionTitle: "v2" },
            ],
            categories: ["Talmud"],
          }),
        });
      }

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const sources = await client.getSourcesForText("Text with refs", "english", 5);

      expect(sources).toHaveLength(5);
    });
  });

  describe("resolveRef", () => {
    it("retourne les completions pour un ref valide", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          is_ref: true,
          completions: ["Berakhot 5a", "Berakhot 5b"],
        }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.resolveRef("Berakhot");

      expect(result).toEqual(["Berakhot 5a", "Berakhot 5b"]);
    });

    it("retourne [] si la ref n'est pas valide (is_ref=false)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ is_ref: false, completions: [] }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.resolveRef("invalid-ref");

      expect(result).toEqual([]);
    });

    it("retourne [] si l'API répond non-ok", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.resolveRef("unknown");

      expect(result).toEqual([]);
    });

    it("retourne [] en cas d'erreur réseau", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.resolveRef("Berakhot");

      expect(result).toEqual([]);
    });
  });

  describe("searchByKeywords", () => {
    it("retourne [] si la recherche ne donne aucun résultat", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hits: { hits: [] } }),
      });

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.searchByKeywords(["prière", "matin"]);

      expect(result).toEqual([]);
    });

    it("retourne [] en cas d'erreur réseau", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = new SefariaClient("https://www.sefaria.org", null, 86400);
      const result = await client.searchByKeywords(["Torah"]);

      expect(result).toEqual([]);
    });
  });
});
