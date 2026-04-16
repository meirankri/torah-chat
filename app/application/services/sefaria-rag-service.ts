/**
 * RAG service pour les sources Sefaria indexées dans Vectorize via Gemini Embedding.
 *
 * Pipeline : question FR/EN/HE → embed via Gemini (1536 dim, taskType=RETRIEVAL_QUERY)
 *            → query Vectorize torah-chat-sefaria → fetch chunks D1 → format sources.
 *
 * Utilise le modèle gemini-embedding-001 (94% recall@1 sur le golden set Sefaria).
 * Le binding Vectorize est VECTORIZE_SEFARIA.
 */

const GEMINI_EMBEDDING_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const EMBEDDING_DIM = 1536;
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.5;

export interface SefariaRagSource {
  id: string;
  ref: string;
  book: string;
  category: string;
  he: string;
  en: string | null;
  fr: string | null;
  commentary_on: string | null;
  score: number;
}

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: { ref?: string; book?: string; category?: string };
}

interface VectorizeQueryResult {
  matches: VectorizeMatch[];
}

interface VectorizeBinding {
  query: (
    vector: number[],
    options: { topK: number; returnMetadata?: string }
  ) => Promise<VectorizeQueryResult>;
}

interface D1ChunkRow {
  id: string;
  ref: string;
  book: string;
  category: string;
  he: string;
  en: string | null;
  fr: string | null;
  commentary_on: string | null;
}

/**
 * Génère un embedding de requête via Gemini Embedding (taskType=RETRIEVAL_QUERY).
 * Le taskType QUERY produit un vecteur optimisé pour matcher des documents
 * embeddés en RETRIEVAL_DOCUMENT (asymmetric retrieval).
 */
export async function embedQueryGemini(
  apiKey: string,
  text: string
): Promise<number[]> {
  const body = {
    model: "models/gemini-embedding-001",
    content: { parts: [{ text }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: EMBEDDING_DIM,
  };

  const resp = await fetch(GEMINI_EMBEDDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Gemini embed query ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

/**
 * Query Vectorize pour les top-K chunks les plus similaires à la question.
 */
export async function queryVectorizeSefaria(
  vectorize: VectorizeBinding,
  embedding: number[],
  topK: number = DEFAULT_TOP_K
): Promise<VectorizeMatch[]> {
  const result = await vectorize.query(embedding, {
    topK,
    returnMetadata: "all",
  });
  return result.matches ?? [];
}

/**
 * Hydrate les ids Vectorize avec les textes complets depuis D1.
 */
export async function fetchSefariaChunks(
  db: D1Database,
  ids: string[]
): Promise<Map<string, D1ChunkRow>> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT id, ref, book, category, he, en, fr, commentary_on
       FROM sefaria_chunks WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all<D1ChunkRow>();
  const map = new Map<string, D1ChunkRow>();
  for (const row of results) map.set(row.id, row);
  return map;
}

/**
 * Pipeline complet : question → top-K sources Sefaria via Vectorize.
 * Retourne uniquement les matches au-dessus de minScore (pour activer le fallback).
 */
export async function retrieveSefariaRagSources(
  geminiKey: string,
  vectorize: VectorizeBinding | null | undefined,
  db: D1Database,
  question: string,
  topK: number = DEFAULT_TOP_K,
  minScore: number = DEFAULT_MIN_SCORE
): Promise<SefariaRagSource[]> {
  if (!vectorize || !geminiKey) return [];

  try {
    const embedding = await embedQueryGemini(geminiKey, question);
    const matches = await queryVectorizeSefaria(vectorize, embedding, topK);
    const filtered = matches.filter((m) => m.score >= minScore);
    if (filtered.length === 0) return [];

    const chunks = await fetchSefariaChunks(
      db,
      filtered.map((m) => m.id)
    );

    const sources: SefariaRagSource[] = [];
    for (const m of filtered) {
      const chunk = chunks.get(m.id);
      if (!chunk) continue;
      sources.push({
        id: chunk.id,
        ref: chunk.ref,
        book: chunk.book,
        category: chunk.category,
        he: chunk.he,
        en: chunk.en,
        fr: chunk.fr,
        commentary_on: chunk.commentary_on,
        score: m.score,
      });
    }
    return sources;
  } catch (err) {
    console.error("[SefariaRAG] retrieve failed:", err);
    return [];
  }
}

/**
 * Formate les sources RAG Sefaria pour injection dans le system prompt.
 * Même format que buildSourceContext pour cohérence côté LLM.
 */
export function buildSefariaRagContext(sources: SefariaRagSource[]): string {
  if (sources.length === 0) return "";
  const blocks = sources.map((s) => {
    let text = `[${s.ref}]`;
    if (s.commentary_on) text += ` (commentaire sur ${s.commentary_on})`;
    if (s.he) text += `\nHébreu : ${s.he}`;
    if (s.fr) text += `\nTraduction : ${s.fr}`;
    else if (s.en) text += `\nTraduction : ${s.en}`;
    return text;
  });
  return `\n\nSOURCES SEFARIA (recherche sémantique, pertinence décroissante) :\n${blocks.join("\n\n")}`;
}
