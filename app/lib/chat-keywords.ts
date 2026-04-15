import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { CustomSource } from "~/application/services/rag-service";

// French stop-words to filter out when extracting raw keywords
export const FR_STOP_WORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "ou", "est",
  "que", "qui", "dans", "sur", "pour", "par", "avec", "sans", "au", "aux",
  "ce", "se", "en", "ne", "pas", "plus", "il", "elle", "nous", "vous",
  "ils", "elles", "je", "tu", "me", "te", "lui", "leur", "cela", "cet",
  "cette", "quoi", "quel", "quelle", "quels", "quelles", "tout", "tous",
  "toute", "toutes", "même", "aussi", "bien", "très", "mais", "donc",
  "car", "si", "alors", "entre", "vers", "depuis", "selon", "comment",
  "pourquoi", "quand", "où", "soit", "être", "avoir", "fait", "font",
]);

// Common French→English translations for Jewish/Torah terms
export const FR_TO_EN_TERMS: Record<string, string> = {
  "guilgoul": "gilgul",
  "guilgul": "gilgul",
  "réincarnation": "reincarnation",
  "transmigration": "transmigration soul",
  "âme": "neshama soul",
  "ames": "neshamot souls",
  "kabbale": "kabbalah",
  "talmud": "talmud",
  "torah": "torah",
  "halakha": "halakha",
  "halacha": "halacha",
  "shabbat": "shabbat",
  "chabbat": "shabbat",
  "techouva": "teshuva",
  "teshuvah": "teshuva",
  "mitzvot": "mitzvot",
  "mitzvah": "mitzvah",
  "hassidout": "hasidut",
  "hassidisme": "hasidism",
  "midrash": "midrash",
  "aggadah": "aggadah",
  "halakhah": "halakha",
  "moussar": "mussar",
  "rambam": "Rambam",
  "ramban": "Ramban",
  "maïmonide": "Maimonides",
  "zohar": "Zohar",
  "croit": "belief",
  "croyance": "belief",
  "interdit": "prohibited forbidden",
  "permis": "permitted",
  "lois": "laws",
  "prière": "prayer",
  "sacrifice": "sacrifice korban",
};

/**
 * Extract meaningful search keywords from a raw question.
 * Translates common French Torah terms to English for Sefaria search.
 */
export function extractKeywordsFromQuestion(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[?!.,;:'"()«»]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !FR_STOP_WORDS.has(w));

  const translated: string[] = [];
  const used = new Set<string>();

  for (const word of words) {
    const en = FR_TO_EN_TERMS[word];
    if (en && !used.has(en)) {
      translated.push(en);
      used.add(en);
    } else if (!en && !used.has(word)) {
      translated.push(word);
      used.add(word);
    }
  }

  // Return up to 4 keywords (Sefaria search handles multi-word queries)
  return translated.slice(0, 4);
}

export function buildSourceContext(sources: SefariaSourceResult[]): string {
  if (sources.length === 0) return "";

  const parts = sources.map((s) => {
    let text = `[${s.ref}]`;
    if (s.textHebrew) text += `\nHébreu : ${s.textHebrew}`;
    if (s.textTranslation) text += `\nTraduction : ${s.textTranslation}`;
    return text;
  });

  return `\n\nSOURCES DISPONIBLES (vérifiées sur Sefaria) :\n${parts.join("\n\n")}`;
}

export function buildCustomSourceContext(customSources: CustomSource[]): string {
  if (customSources.length === 0) return "";

  const parts = customSources.map((s) => {
    const ref = s.author ? `${s.title} — ${s.author}` : s.title;
    return `[${ref}]\n${s.content}`;
  });

  return `\n\nSOURCES ADDITIONNELLES (livres indexés) :\n${parts.join("\n\n")}`;
}
