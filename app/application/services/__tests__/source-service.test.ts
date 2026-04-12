import { describe, it, expect } from "vitest";
import {
  sefariaResultToMessageSource,
  mapSefariaResultsToSources,
} from "../source-service";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";

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
});
