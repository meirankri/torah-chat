import { describe, it, expect } from "vitest";
import {
  extractKeywordsFromQuestion,
  buildSourceContext,
  buildCustomSourceContext,
  FR_STOP_WORDS,
  FR_TO_EN_TERMS,
} from "../chat-keywords";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { CustomSource } from "~/application/services/rag-service";

describe("extractKeywordsFromQuestion", () => {
  it("extrait des mots-clés d'une question simple", () => {
    const keywords = extractKeywordsFromQuestion("Qu'est-ce que le Shabbat ?");
    expect(keywords).toContain("shabbat");
  });

  it("traduit les termes Torah français vers l'anglais", () => {
    const keywords = extractKeywordsFromQuestion("Qu'est-ce que la Kabbale ?");
    expect(keywords).toContain("kabbalah");
    expect(keywords).not.toContain("kabbale");
  });

  it("traduit guilgoul en gilgul", () => {
    const keywords = extractKeywordsFromQuestion("Parle-moi du guilgoul des âmes");
    expect(keywords).toContain("gilgul");
  });

  it("traduit techouva en teshuva", () => {
    const keywords = extractKeywordsFromQuestion("Comment faire la techouva ?");
    expect(keywords).toContain("teshuva");
  });

  it("traduit maïmonide en Maimonides", () => {
    const keywords = extractKeywordsFromQuestion("Que dit Maïmonide sur la prière ?");
    expect(keywords).toContain("Maimonides");
  });

  it("filtre les stop-words français", () => {
    const keywords = extractKeywordsFromQuestion("Comment est-ce que la prière fonctionne ?");
    // "comment", "est", "que", "la" sont des stop-words
    expect(keywords).not.toContain("comment");
    expect(keywords).not.toContain("est");
    expect(keywords).not.toContain("que");
    expect(keywords).not.toContain("la");
  });

  it("filtre les mots de moins de 4 caractères", () => {
    const keywords = extractKeywordsFromQuestion("Qui dit quoi sur le Talmud ?");
    expect(keywords).not.toContain("qui");
    expect(keywords).not.toContain("sur");
    expect(keywords).toContain("talmud");
  });

  it("déponctuate avant d'extraire", () => {
    const keywords = extractKeywordsFromQuestion("Torah, Talmud et Midrash ?");
    expect(keywords).toContain("talmud");
    expect(keywords).toContain("torah");
  });

  it("limite à 4 mots-clés maximum", () => {
    const question = "Torah Talmud Midrash Shabbat Halakha Kabbale Mitzvah Techouva";
    const keywords = extractKeywordsFromQuestion(question);
    expect(keywords.length).toBeLessThanOrEqual(4);
  });

  it("déduplique les mots-clés (même terme plusieurs fois)", () => {
    const keywords = extractKeywordsFromQuestion("Shabbat shabbat Shabbat");
    const shabbatCount = keywords.filter((k) => k === "shabbat").length;
    expect(shabbatCount).toBe(1);
  });

  it("retourne tableau vide pour question vide", () => {
    expect(extractKeywordsFromQuestion("")).toEqual([]);
  });

  it("retourne tableau vide si que des stop-words", () => {
    const keywords = extractKeywordsFromQuestion("le la les de du des");
    expect(keywords).toHaveLength(0);
  });
});

describe("buildSourceContext", () => {
  it("retourne chaîne vide pour tableau vide", () => {
    expect(buildSourceContext([])).toBe("");
  });

  it("formate une source avec hébreu et traduction", () => {
    const source: SefariaSourceResult = {
      ref: "Berakhot 5a",
      heRef: "ברכות ה א",
      textHebrew: "אמר רבי לוי",
      textTranslation: "Rabbi Levi said",
      translationLanguage: "english",
      category: "Talmud",
      sefariaUrl: "https://www.sefaria.org/Berakhot%205a",
    };
    const context = buildSourceContext([source]);
    expect(context).toContain("[Berakhot 5a]");
    expect(context).toContain("אמר רבי לוי");
    expect(context).toContain("Rabbi Levi said");
    expect(context).toContain("SOURCES DISPONIBLES");
  });

  it("formate plusieurs sources avec séparateur", () => {
    const sources: SefariaSourceResult[] = [
      { ref: "Gen 1:1", heRef: "בר א", textHebrew: "בראשית", textTranslation: "In the beginning", translationLanguage: "english", category: "Torah", sefariaUrl: "" },
      { ref: "Ex 20:8", heRef: "שמ כ", textHebrew: "זכור", textTranslation: "Remember", translationLanguage: "english", category: "Torah", sefariaUrl: "" },
    ];
    const context = buildSourceContext(sources);
    expect(context).toContain("[Gen 1:1]");
    expect(context).toContain("[Ex 20:8]");
  });

  it("gère une source sans texte hébreu", () => {
    const source: SefariaSourceResult = {
      ref: "Test 1:1",
      heRef: "",
      textHebrew: null,
      textTranslation: "English only",
      translationLanguage: "english",
      category: "Other",
      sefariaUrl: "",
    };
    const context = buildSourceContext([source]);
    expect(context).toContain("[Test 1:1]");
    expect(context).toContain("English only");
    expect(context).not.toContain("Hébreu");
  });
});

describe("buildCustomSourceContext", () => {
  it("retourne chaîne vide pour tableau vide", () => {
    expect(buildCustomSourceContext([])).toBe("");
  });

  it("formate une source custom avec author", () => {
    const source: CustomSource = {
      id: "c1",
      title: "Rambam — Lois de la Prière",
      author: "Maïmonide",
      category: "Halakha",
      content: "On doit prier trois fois par jour.",
      chunkIndex: 0,
    };
    const context = buildCustomSourceContext([source]);
    expect(context).toContain("[Rambam — Lois de la Prière — Maïmonide]");
    expect(context).toContain("On doit prier trois fois par jour.");
    expect(context).toContain("SOURCES ADDITIONNELLES");
  });

  it("formate une source custom sans author (ref = titre uniquement)", () => {
    const source: CustomSource = {
      id: "c2",
      title: "Zohar",
      author: null,
      category: "Kabbale",
      content: "La lumière divine.",
      chunkIndex: 0,
    };
    const context = buildCustomSourceContext([source]);
    expect(context).toContain("[Zohar]");
    expect(context).not.toContain("null");
  });

  it("inclut le contenu de chaque source", () => {
    const sources: CustomSource[] = [
      { id: "c1", title: "Livre A", author: "Auteur", category: "Torah", content: "Contenu A", chunkIndex: 0 },
      { id: "c2", title: "Livre B", author: null, category: "Talmud", content: "Contenu B", chunkIndex: 1 },
    ];
    const context = buildCustomSourceContext(sources);
    expect(context).toContain("Contenu A");
    expect(context).toContain("Contenu B");
  });
});

describe("FR_STOP_WORDS", () => {
  it("contient les mots de liaison courants", () => {
    expect(FR_STOP_WORDS.has("le")).toBe(true);
    expect(FR_STOP_WORDS.has("la")).toBe(true);
    expect(FR_STOP_WORDS.has("les")).toBe(true);
    expect(FR_STOP_WORDS.has("pour")).toBe(true);
    expect(FR_STOP_WORDS.has("dans")).toBe(true);
  });

  it("ne contient pas de termes Torah importants", () => {
    expect(FR_STOP_WORDS.has("shabbat")).toBe(false);
    expect(FR_STOP_WORDS.has("torah")).toBe(false);
    expect(FR_STOP_WORDS.has("talmud")).toBe(false);
  });
});

describe("FR_TO_EN_TERMS", () => {
  it("contient les traductions Torah principales", () => {
    expect(FR_TO_EN_TERMS["kabbale"]).toBe("kabbalah");
    expect(FR_TO_EN_TERMS["shabbat"]).toBe("shabbat");
    expect(FR_TO_EN_TERMS["techouva"]).toBe("teshuva");
    expect(FR_TO_EN_TERMS["moussar"]).toBe("mussar");
    expect(FR_TO_EN_TERMS["rambam"]).toBe("Rambam");
  });

  it("gère les variantes orthographiques (guilgoul/guilgul)", () => {
    expect(FR_TO_EN_TERMS["guilgoul"]).toBe("gilgul");
    expect(FR_TO_EN_TERMS["guilgul"]).toBe("gilgul");
    expect(FR_TO_EN_TERMS["chabbat"]).toBe("shabbat");
  });
});
