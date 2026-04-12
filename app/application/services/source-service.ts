import type { MessageSource } from "~/domain/entities/source";
import type { SefariaSourceResult } from "~/infrastructure/sefaria/sefaria-client";

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
