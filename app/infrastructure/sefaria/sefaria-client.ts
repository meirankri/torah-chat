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

interface SefariaSearchHit {
  _score: number;
  _source: {
    ref: string;
    heRef: string;
    categories: string[];
  };
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

  /**
   * Resolve a book/ref name via Sefaria's name API, returning the most specific valid completions.
   */
  async resolveRef(refName: string): Promise<string[]> {
    const url = `${this.baseUrl}/api/name/${encodeURIComponent(refName)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`[Sefaria] resolveRef: "${refName}" not found (${response.status})`);
        return [];
      }

      const data = (await response.json()) as {
        is_ref?: boolean;
        completions?: string[];
      };

      if (!data.is_ref || !data.completions || data.completions.length === 0) {
        console.log(`[Sefaria] resolveRef: "${refName}" is not a valid ref`);
        return [];
      }

      console.log(`[Sefaria] resolveRef: "${refName}" → ${data.completions.length} completions`);
      return data.completions;
    } catch (error) {
      console.error(`[Sefaria] resolveRef error for "${refName}":`, error);
      return [];
    }
  }

  /**
   * Search within specific books by combining keywords with a path filter.
   * First resolves book names to valid Sefaria paths, then searches full-text within those books.
   */
  async searchByRefs(
    refNames: string[],
    keywords: string[],
    translationLang: string = "english",
    maxSources: number = 5
  ): Promise<SefariaSourceResult[]> {
    const allHits: SefariaSearchHit[] = [];

    for (const refName of refNames) {
      // First verify the ref exists on Sefaria
      const completions = await this.resolveRef(refName);
      if (completions.length === 0) continue;

      // Extract the book name (first completion or the ref itself)
      const bookName = completions[0] ?? refName;

      // Search full-text within this book using path wildcard filter
      const query = keywords.length > 0 ? keywords.join(" ") : refName;
      const searchUrl = `${this.baseUrl}/api/search/text/_search`;
      console.log(`[Sefaria] searchByRefs: searching "${query}" within book "${bookName}"`);

      try {
        const response = await fetch(searchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: {
              bool: {
                must: [{
                  multi_match: {
                    query,
                    fields: ["naive_lemmatizer", "exact"],
                    type: "best_fields",
                  },
                }],
                filter: [{
                  wildcard: { path: `*${bookName.split(",")[0]}*` },
                }],
              },
            },
            size: maxSources,
            _source: ["ref", "heRef", "categories"],
          }),
        });

        if (!response.ok) {
          console.error(`[Sefaria] searchByRefs: search failed for "${bookName}": ${response.status}`);
          continue;
        }

        const data = (await response.json()) as {
          hits?: { hits?: SefariaSearchHit[] };
        };

        const hits = data.hits?.hits ?? [];
        console.log(`[Sefaria] searchByRefs: ${hits.length} hits in "${bookName}"`);
        allHits.push(...hits);
      } catch (error) {
        console.error(`[Sefaria] searchByRefs error for "${bookName}":`, error);
      }
    }

    if (allHits.length === 0) return [];

    // Deduplicate by ref
    const uniqueRefs = [...new Set(allHits.map((h) => h._source.ref))];
    console.log(`[Sefaria] searchByRefs: fetching texts for ${uniqueRefs.length} unique refs`);

    const results = await Promise.allSettled(
      uniqueRefs.slice(0, maxSources).map((ref) => this.getText(ref, translationLang))
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<SefariaSourceResult | null> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value)
      .filter((r): r is SefariaSourceResult => r !== null);
  }

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

      // Fetch translation — try requested language, fallback to English
      let translationText: string | null = null;
      let actualTranslationLang = translationLang;
      const langsToTry = translationLang === "english"
        ? ["english"]
        : [translationLang, "english"];

      for (const lang of langsToTry) {
        try {
          const translationUrl = `${this.baseUrl}/api/v3/texts/${encodeURIComponent(ref)}?version=${lang}`;
          const translationResponse = await fetch(translationUrl);
          if (translationResponse.ok) {
            const translationData =
              (await translationResponse.json()) as SefariaTextResponse;
            const translationVersions = translationData.versions.filter(
              (v) => v.language !== "he"
            );
            if (translationVersions.length > 0 && translationVersions[0]) {
              translationText = stripHtml(flattenText(translationVersions[0].text));
              actualTranslationLang = lang;
              console.log(`[Sefaria] getText: translation found for ${ref} in ${lang}`);
              break;
            }
          }
        } catch {
          // Translation not available in this language, try next
        }
      }

      if (!translationText) {
        console.log(`[Sefaria] getText: no translation found for ${ref}`);
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
        translationLanguage: actualTranslationLang,
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
    console.log(`[Sefaria] getSourcesForText: ${refs.length} refs found via find-refs`);
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

  /**
   * Search Sefaria's full-text index by keywords, then fetch texts for top hits.
   */
  /**
   * Search by exact Hebrew/Aramaic phrase via Sefaria Elasticsearch.
   * Optionally filter by category (Tanakh, Talmud, Commentary, etc.).
   * Used by the search agent for exhaustive/occurrence queries.
   */
  async searchByHebrewPhrase(
    phrase: string,
    options: { category?: string; translationLang?: string; maxSources?: number } = {}
  ): Promise<SefariaSourceResult[]> {
    const { category, translationLang = "english", maxSources = 10 } = options;
    const searchUrl = `${this.baseUrl}/api/search/text/_search`;
    console.log(`[Sefaria] searchByHebrewPhrase: "${phrase.slice(0, 40)}..." category=${category ?? "all"}`);

    const must = [{ multi_match: { query: phrase, fields: ["exact"], type: "phrase" as const } }];
    const filter = category ? [{ term: { categories: category } }] : [];

    try {
      const response = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { bool: { must, filter } },
          size: maxSources * 3, // over-fetch for dedup
          _source: ["ref", "heRef", "categories"],
        }),
      });

      if (!response.ok) {
        console.error(`[Sefaria] searchByHebrewPhrase failed: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as { hits?: { hits?: SefariaSearchHit[] } };
      const hits = data.hits?.hits ?? [];

      // Deduplicate by ref
      const uniqueRefs = [...new Set(hits.map((h) => h._source.ref))].slice(0, maxSources);
      console.log(`[Sefaria] searchByHebrewPhrase: ${uniqueRefs.length} unique refs from ${hits.length} hits`);
      if (uniqueRefs.length === 0) return [];

      const results = await Promise.allSettled(
        uniqueRefs.map((ref) => this.getText(ref, translationLang))
      );

      return results
        .filter((r): r is PromiseFulfilledResult<SefariaSourceResult | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((r): r is SefariaSourceResult => r !== null);
    } catch (error) {
      console.error("[Sefaria] searchByHebrewPhrase error:", error);
      return [];
    }
  }

  async searchByKeywords(
    keywords: string[],
    translationLang: string = "english",
    maxSources: number = 5
  ): Promise<SefariaSourceResult[]> {
    const query = keywords.join(" ");
    const searchUrl = `${this.baseUrl}/api/search/text/_search`;
    console.log(`[Sefaria] searchByKeywords: query="${query}", url=${searchUrl}`);

    try {
      const response = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: {
            multi_match: {
              query,
              fields: ["naive_lemmatizer", "exact"],
              type: "best_fields",
            },
          },
          size: maxSources,
          _source: ["ref", "heRef", "categories"],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        console.error(`[Sefaria] searchByKeywords failed: status=${response.status}, body=${errorBody}`);
        return [];
      }

      const data = (await response.json()) as {
        hits?: { hits?: SefariaSearchHit[] };
      };

      const hits = data.hits?.hits ?? [];
      console.log(`[Sefaria] searchByKeywords: ${hits.length} hits found`);
      if (hits.length === 0) return [];

      // Deduplicate by ref
      const uniqueRefs = [...new Set(hits.map((h) => h._source.ref))];

      const results = await Promise.allSettled(
        uniqueRefs.slice(0, maxSources).map((ref) => this.getText(ref, translationLang))
      );

      return results
        .filter(
          (r): r is PromiseFulfilledResult<SefariaSourceResult | null> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value)
        .filter((r): r is SefariaSourceResult => r !== null);
    } catch (error) {
      console.error("Sefaria search error:", error);
      return [];
    }
  }
}
