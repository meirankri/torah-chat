export interface SefariaRef {
  ref: string;
  url: string;
}

export interface SefariaLinkerResponse {
  title: string;
  refs: SefariaRef[];
}

export interface SefariaTextVersion {
  text: string | string[];
  versionTitle: string;
  language: string;
}

export interface SefariaTextResponse {
  ref: string;
  heRef: string;
  versions: SefariaTextVersion[];
  categories: string[];
}

export interface SefariaSourceResult {
  ref: string;
  heRef: string;
  textHebrew: string;
  textTranslation: string | null;
  translationLanguage: string;
  category: string;
  sefariaUrl: string;
}

function flattenText(text: string | string[]): string {
  if (Array.isArray(text)) {
    return text.flat(Infinity).join(" ");
  }
  return text;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export class SefariaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly cache: KVNamespace | null,
    private readonly cacheTtlSeconds: number
  ) {}

  async findRefs(text: string): Promise<string[]> {
    const url = `${this.baseUrl}/api/find-refs`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: { body: text } }),
      });

      if (!response.ok) {
        console.error(`Sefaria find-refs failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { refs?: string[] };
      if (!data.refs || !Array.isArray(data.refs)) {
        return [];
      }

      // Deduplicate refs
      return [...new Set(data.refs)];
    } catch (error) {
      console.error("Sefaria find-refs error:", error);
      return [];
    }
  }

  async getText(
    ref: string,
    translationLang: string = "english"
  ): Promise<SefariaSourceResult | null> {
    const cacheKey = `sefaria:${ref}:${translationLang}`;

    // Try cache first
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SefariaSourceResult;
      }
    }

    try {
      // Fetch Hebrew text
      const hebrewUrl = `${this.baseUrl}/api/v3/texts/${encodeURIComponent(ref)}`;
      const hebrewResponse = await fetch(hebrewUrl);

      if (!hebrewResponse.ok) {
        console.error(`Sefaria text fetch failed for ${ref}: ${hebrewResponse.status}`);
        return null;
      }

      const hebrewData = (await hebrewResponse.json()) as SefariaTextResponse;

      const hebrewText = hebrewData.versions
        .filter((v) => v.language === "he")
        .map((v) => stripHtml(flattenText(v.text)))
        .join(" ");

      // Fetch translation
      let translationText: string | null = null;
      const translationUrl = `${this.baseUrl}/api/v3/texts/${encodeURIComponent(ref)}?version=${translationLang}`;
      try {
        const translationResponse = await fetch(translationUrl);
        if (translationResponse.ok) {
          const translationData =
            (await translationResponse.json()) as SefariaTextResponse;
          const translationVersions = translationData.versions.filter(
            (v) => v.language !== "he"
          );
          if (translationVersions.length > 0 && translationVersions[0]) {
            translationText = stripHtml(flattenText(translationVersions[0].text));
          }
        }
      } catch {
        // Translation not available, continue without it
      }

      const category =
        hebrewData.categories.length > 0
          ? (hebrewData.categories[0] ?? "Other")
          : "Other";

      const result: SefariaSourceResult = {
        ref: hebrewData.ref,
        heRef: hebrewData.heRef,
        textHebrew: hebrewText,
        textTranslation: translationText,
        translationLanguage: translationLang,
        category,
        sefariaUrl: `${this.baseUrl}/${encodeURIComponent(ref)}`,
      };

      // Cache the result
      if (this.cache) {
        await this.cache.put(cacheKey, JSON.stringify(result), {
          expirationTtl: this.cacheTtlSeconds,
        });
      }

      return result;
    } catch (error) {
      console.error(`Sefaria text fetch error for ${ref}:`, error);
      return null;
    }
  }

  async getSourcesForText(
    text: string,
    translationLang: string = "english",
    maxSources: number = 5
  ): Promise<SefariaSourceResult[]> {
    const refs = await this.findRefs(text);
    if (refs.length === 0) return [];

    const limitedRefs = refs.slice(0, maxSources);

    const results = await Promise.allSettled(
      limitedRefs.map((ref) => this.getText(ref, translationLang))
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<SefariaSourceResult | null> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .filter((r): r is SefariaSourceResult => r !== null);
  }
}
