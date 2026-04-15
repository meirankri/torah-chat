import { describe, it, expect } from "vitest";
import {
  sefariaResultToMessageSource,
  mapSefariaResultsToSources,
  customSourceToMessageSource,
  mapCustomSourcesToSources,
} from "../source-service";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { CustomSource } from "~/application/services/rag-service";

const MOCK_RESULT: SefariaSourceResult = {
  ref: "Berakhot 5a",
  heRef: "ברכות ה א",
  textHebrew: "Hebrew text",
  textTranslation: "English translation",
  translationLanguage: "english",
  category: "Talmud",
  sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
};

describe("source-service", () => {
  describe("sefariaResultToMessageSource", () => {
    it("convertit un résultat Sefaria en MessageSource", () => {
      const source = sefariaResultToMessageSource(MOCK_RESULT, "msg-123");

      expect(source.id).toBeDefined();
      expect(source.id.startsWith("src-")).toBe(true);
      expect(source.messageId).toBe("msg-123");
      expect(source.sourceType).toBe("sefaria");
      expect(source.ref).toBe("Berakhot 5a");
      expect(source.title).toBe("ברכות ה א");
      expect(source.textHebrew).toBe("Hebrew text");
      expect(source.textTranslation).toBe("English translation");
      expect(source.translationLanguage).toBe("english");
      expect(source.category).toBe("Talmud");
      expect(source.sefariaUrl).toBe("https://www.sefaria.org/Berakhot%205a");
      expect(source.createdAt).toBeDefined();
    });
  });

  describe("mapSefariaResultsToSources", () => {
    it("convertit plusieurs résultats", () => {
      const results: SefariaSourceResult[] = [
        MOCK_RESULT,
        { ...MOCK_RESULT, ref: "Shabbat 31a", heRef: "שבת לא א" },
      ];

      const sources = mapSefariaResultsToSources(results, "msg-456");

      expect(sources).toHaveLength(2);
      expect(sources[0]!.ref).toBe("Berakhot 5a");
      expect(sources[1]!.ref).toBe("Shabbat 31a");
      expect(sources[0]!.messageId).toBe("msg-456");
      expect(sources[1]!.messageId).toBe("msg-456");
    });

    it("retourne un tableau vide si aucun résultat", () => {
      const sources = mapSefariaResultsToSources([], "msg-789");
      expect(sources).toEqual([]);
    });

    it("génère des IDs uniques pour chaque source", () => {
      const results = [MOCK_RESULT, MOCK_RESULT, MOCK_RESULT];
      const sources = mapSefariaResultsToSources(results, "msg-1");
      const ids = new Set(sources.map((s) => s.id));
      expect(ids.size).toBe(3);
    });
  });

  describe("customSourceToMessageSource", () => {
    const CUSTOM_SOURCE: CustomSource = {
      id: "chunk-1",
      title: "Rambam — Lois de la Prière",
      author: "Maïmonide",
      category: "Halakha",
      content: "On doit prier trois fois par jour.",
      chunkIndex: 0,
    };

    it("convertit une source custom en MessageSource avec ref title+author", () => {
      const source = customSourceToMessageSource(CUSTOM_SOURCE, "msg-1");
      expect(source.sourceType).toBe("custom");
      expect(source.ref).toBe("Rambam — Lois de la Prière — Maïmonide");
      expect(source.title).toBe("Rambam — Lois de la Prière");
      expect(source.textTranslation).toBe("On doit prier trois fois par jour.");
      expect(source.textHebrew).toBeNull();
      expect(source.sefariaUrl).toBeNull();
      expect(source.category).toBe("Halakha");
      expect(source.messageId).toBe("msg-1");
    });

    it("utilise juste le titre comme ref si pas d'auteur", () => {
      const sourceNoAuthor: CustomSource = { ...CUSTOM_SOURCE, author: null };
      const source = customSourceToMessageSource(sourceNoAuthor, "msg-2");
      expect(source.ref).toBe("Rambam — Lois de la Prière");
    });

    it("retourne null pour sefariaUrl (source custom)", () => {
      const source = customSourceToMessageSource(CUSTOM_SOURCE, "msg-3");
      expect(source.sefariaUrl).toBeNull();
    });
  });

  describe("mapCustomSourcesToSources", () => {
    it("convertit plusieurs sources custom", () => {
      const customSources: CustomSource[] = [
        { id: "c1", title: "Livre 1", author: "Auteur 1", category: "Torah", content: "Contenu 1", chunkIndex: 0 },
        { id: "c2", title: "Livre 2", author: null, category: "Talmud", content: "Contenu 2", chunkIndex: 1 },
      ];
      const sources = mapCustomSourcesToSources(customSources, "msg-10");
      expect(sources).toHaveLength(2);
      expect(sources[0]?.sourceType).toBe("custom");
      expect(sources[1]?.sourceType).toBe("custom");
      expect(sources[0]?.ref).toBe("Livre 1 — Auteur 1");
      expect(sources[1]?.ref).toBe("Livre 2");
    });

    it("retourne un tableau vide si aucune source", () => {
      expect(mapCustomSourcesToSources([], "msg-11")).toEqual([]);
    });
  });
});
