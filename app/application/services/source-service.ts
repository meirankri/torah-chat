import type { MessageSource } from "~/domain/entities/source";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { CustomSource } from "~/application/services/rag-service";
import type { SefariaRagSource } from "~/application/services/sefaria-rag-service";

export function generateSourceId(): string {
  return `src-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sefariaResultToMessageSource(
  result: SefariaSourceResult,
  messageId: string
): MessageSource {
  return {
    id: generateSourceId(),
    messageId,
    sourceType: "sefaria",
    ref: result.ref,
    title: result.heRef,
    textHebrew: result.textHebrew,
    textTranslation: result.textTranslation,
    translationLanguage: result.translationLanguage,
    category: result.category,
    sefariaUrl: result.sefariaUrl,
    createdAt: new Date().toISOString(),
  };
}

export function mapSefariaResultsToSources(
  results: SefariaSourceResult[],
  messageId: string
): MessageSource[] {
  return results.map((result) =>
    sefariaResultToMessageSource(result, messageId)
  );
}

export function customSourceToMessageSource(
  source: CustomSource,
  messageId: string
): MessageSource {
  const ref = source.author
    ? `${source.title} — ${source.author}`
    : source.title;
  return {
    id: generateSourceId(),
    messageId,
    sourceType: "custom",
    ref,
    title: source.title,
    textHebrew: null,
    textTranslation: source.content,
    translationLanguage: null,
    category: source.category,
    sefariaUrl: null,
    createdAt: new Date().toISOString(),
  };
}

export function mapCustomSourcesToSources(
  sources: CustomSource[],
  messageId: string
): MessageSource[] {
  return sources.map((s) => customSourceToMessageSource(s, messageId));
}

export function sefariaRagSourceToMessageSource(
  source: SefariaRagSource,
  messageId: string
): MessageSource {
  const sefariaUrl = `https://www.sefaria.org/${encodeURIComponent(source.ref.replace(/ /g, "_"))}`;
  return {
    id: generateSourceId(),
    messageId,
    sourceType: "sefaria",
    ref: source.ref,
    title: source.ref,
    textHebrew: source.he,
    textTranslation: source.fr ?? source.en,
    translationLanguage: source.fr ? "french" : source.en ? "english" : null,
    category: source.category,
    sefariaUrl,
    createdAt: new Date().toISOString(),
  };
}

export function mapSefariaRagSourcesToSources(
  sources: SefariaRagSource[],
  messageId: string
): MessageSource[] {
  return sources.map((s) => sefariaRagSourceToMessageSource(s, messageId));
}
