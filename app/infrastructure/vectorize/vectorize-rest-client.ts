/**
 * Fallback REST client pour Cloudflare Vectorize + D1.
 *
 * Utilise quand les bindings VECTORIZE_SEFARIA / D1 ne sont pas disponibles
 * (local dev sans --remote). Implemente les memes interfaces que les bindings natifs.
 */

const CF_ACCOUNT_ID = "41de2c6559dce7a77b61dd51dbf412a3";
const VECTORIZE_INDEX = "torah-chat-sefaria";
const D1_DATABASE_ID = "f20d4bad-63ce-4a94-8049-7a6086bb7589";
const VECTORIZE_QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/query`;

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, string>;
}

interface VectorizeQueryResult {
  matches: VectorizeMatch[];
}

interface VectorizeRestApiResponse {
  success: boolean;
  result: {
    matches: VectorizeMatch[];
  };
  errors?: Array<{ message: string }>;
}

interface VectorizeQueryOptions {
  topK: number;
  returnMetadata?: string;
  filter?: Record<string, unknown>;
}

/**
 * Cree un client Vectorize via REST API compatible avec l'interface binding.
 * Le retour implemente la meme interface que env.VECTORIZE_SEFARIA.
 */
export function createVectorizeRestClient(cfApiToken: string): { query: (vector: number[], options: VectorizeQueryOptions) => Promise<VectorizeQueryResult> } {
  return {
    async query(vector: number[], options: VectorizeQueryOptions): Promise<VectorizeQueryResult> {
      const body: Record<string, unknown> = {
        vector,
        topK: options.topK,
      };

      if (options.returnMetadata) {
        body.returnMetadata = options.returnMetadata;
      }

      if (options.filter) {
        body.filter = options.filter;
      }

      const resp = await fetch(VECTORIZE_QUERY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Vectorize REST query ${resp.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await resp.json()) as VectorizeRestApiResponse;

      if (!data.success) {
        const errMsg = data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
        throw new Error(`Vectorize REST query failed: ${errMsg}`);
      }

      // Normalise : l'API REST retourne { result: { matches } }
      // Le binding retourne directement { matches }
      return { matches: data.result.matches ?? [] };
    },
  };
}

// ================ D1 REST Fallback ================

interface D1RestApiResponse {
  success: boolean;
  result: Array<{
    results: Array<Record<string, unknown>>;
    success: boolean;
  }>;
  errors?: Array<{ message: string }>;
}

interface D1RestStatement {
  bind: (...args: unknown[]) => D1RestStatement;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: boolean }>;
  first: <T>() => Promise<T | null>;
}

/**
 * Cree un wrapper D1 via REST API compatible avec l'interface D1Database.
 * Supporte uniquement les methodes prepare().bind().all/run/first
 * utilisees dans le RAG service.
 */
export function createD1RestClient(cfApiToken: string): D1Database {
  const d1QueryUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;

  function createStatement(sql: string): D1RestStatement {
    let boundParams: unknown[] = [];

    const statement: D1RestStatement = {
      bind(...args: unknown[]) {
        boundParams = args;
        return statement;
      },
      async all<T>(): Promise<{ results: T[] }> {
        const resp = await fetch(d1QueryUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql, params: boundParams }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`D1 REST query ${resp.status}: ${errText.slice(0, 200)}`);
        }

        const data = (await resp.json()) as D1RestApiResponse;
        if (!data.success) {
          const errMsg = data.errors?.map((e) => e.message).join(", ") ?? "Unknown error";
          throw new Error(`D1 REST query failed: ${errMsg}`);
        }

        const results = (data.result?.[0]?.results ?? []) as T[];
        return { results };
      },
      async run(): Promise<{ success: boolean }> {
        const resp = await fetch(d1QueryUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql, params: boundParams }),
        });
        return { success: resp.ok };
      },
      async first<T>(): Promise<T | null> {
        const { results } = await statement.all<T>();
        return results[0] ?? null;
      },
    };
    return statement;
  }

  // Retourne un objet compatible D1Database (subset utilise par le RAG)
  return {
    prepare: (sql: string) => createStatement(sql),
  } as D1Database;
}
