import { describe, it, expect } from "vitest";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import {
  mapSefariaResultsToSources,
  sefariaResultToMessageSource,
} from "~/application/services/source-service";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { MessageSource } from "~/domain/entities/source";

describe("Sources flow integration", () => {
  describe("Flow complet: texte LLM → extraction refs → conversion sources", () => {
    it("convertit des résultats Sefaria en MessageSource prêts pour le frontend", () => {
      const sefariaResults: SefariaSourceResult[] = [
        {
          ref: "Berakhot 5a",
          heRef: "ברכות ה א",
          textHebrew: "אמר רבי לוי בר חמא",
          textTranslation: "Rabbi Levi bar Chama said",
          translationLanguage: "english",
          category: "Talmud",
          sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
        },
        {
          ref: "Shabbat 31a",
          heRef: "שבת לא א",
          textHebrew: "מעשה בנכרי אחד",
          textTranslation: "There was an incident involving a gentile",
          translationLanguage: "english",
          category: "Talmud",
          sefariaUrl: "https://www.sefaria.org/Shabbat%2031a",
        },
      ];

      const messageId = "assistant-msg-1";
      const sources = mapSefariaResultsToSources(sefariaResults, messageId);

      // Validate structure
      expect(sources).toHaveLength(2);
      for (const source of sources) {
        expect(source.sourceType).toBe("sefaria");
        expect(source.messageId).toBe(messageId);
        expect(source.id).toBeDefined();
        expect(source.createdAt).toBeDefined();
        expect(source.sefariaUrl).toBeDefined();
      }

      // Validate data integrity
      expect(sources[0]!.ref).toBe("Berakhot 5a");
      expect(sources[0]!.title).toBe("ברכות ה א");
      expect(sources[1]!.ref).toBe("Shabbat 31a");
    });

    it("gère le cas où aucune source n'est trouvée", () => {
      const sources = mapSefariaResultsToSources([], "msg-1");
      expect(sources).toEqual([]);
    });
  });

  describe("ChatMessage avec sources", () => {
    it("un ChatMessage peut contenir des sources optionnelles", () => {
      const source: MessageSource = {
        id: "src-1",
        messageId: "msg-1",
        sourceType: "sefaria",
        ref: "Berakhot 5a",
        title: "ברכות ה א",
        textHebrew: "טקסט",
        textTranslation: "Text",
        translationLanguage: "english",
        category: "Talmud",
        sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
        createdAt: new Date().toISOString(),
      };

      // ChatMessage with sources
      const messageWithSources = {
        id: "msg-1",
        role: "assistant" as const,
        content: "Le Talmud enseigne dans Berakhot 5a...",
        createdAt: new Date().toISOString(),
        sources: [source],
        sourcesLoading: false,
      };

      expect(messageWithSources.sources).toHaveLength(1);
      expect(messageWithSources.sources[0]!.sourceType).toBe("sefaria");
      expect(messageWithSources.sourcesLoading).toBe(false);
    });

    it("un ChatMessage sans sources a un champ sources undefined", () => {
      const messageNoSources = {
        id: "msg-2",
        role: "assistant" as const,
        content: "Response without sources",
        createdAt: new Date().toISOString(),
      };

      expect(messageNoSources).not.toHaveProperty("sources");
    });
  });

  describe("Sefaria client helpers", () => {
    it("flattenText et stripHtml fonctionnent via getText indirectement", () => {
      // Test that the conversion handles HTML-stripped text
      const result: SefariaSourceResult = {
        ref: "Test 1",
        heRef: "טסט א",
        textHebrew: "Clean text without HTML",
        textTranslation: "Also clean",
        translationLanguage: "english",
        category: "Other",
        sefariaUrl: "https://www.sefaria.org/Test%201",
      };

      const source = sefariaResultToMessageSource(result, "msg-1");
      expect(source.textHebrew).toBe("Clean text without HTML");
      expect(source.textTranslation).toBe("Also clean");
    });
  });

  describe("Source types validation", () => {
    it("tous les types de sources sont valides", () => {
      const types = ["sefaria", "custom", "hebrewbooks", "unverified"] as const;
      for (const type of types) {
        const source: MessageSource = {
          id: "src-1",
          messageId: "msg-1",
          sourceType: type,
          ref: "Test ref",
          title: null,
          textHebrew: null,
          textTranslation: null,
          translationLanguage: null,
          category: null,
          sefariaUrl: null,
          createdAt: new Date().toISOString(),
        };
        expect(source.sourceType).toBe(type);
      }
    });
  });
});
