import type { MessageSource } from "~/domain/entities/source";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";
import type { CustomSource } from "~/application/services/rag-service";

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
