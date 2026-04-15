/**
 * RAG (Retrieval-Augmented Generation) service for custom Torah texts.
 * Queries Vectorize for semantically similar chunks to a user question,
 * retrieves the full text from D1, and returns formatted source blocks.
 */

export interface CustomSource {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  content: string;
  chunkIndex: number;
}

interface VectorizeMatch {
  id: string;
  score: number;
}

interface VectorizeQueryResult {
  matches: VectorizeMatch[];
}

interface D1CustomTextRow {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  content: string;
  chunk_index: number;
}

// Cloudflare AI embedding model for text
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

/**
 * Generate a vector embedding for a given text using Workers AI.
 */
export async function generateEmbedding(
  ai: { run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }> },
  text: string
): Promise<number[]> {
  const result = await ai.run(EMBEDDING_MODEL, { text: [text] });
  const embedding = result.data[0];
  if (!embedding) {
    throw new Error("No embedding returned from Workers AI");
  }
  return embedding;
}

/**
 * Query Vectorize for the top-K most similar chunks to a question.
 * Returns their D1 IDs and similarity scores.
 */
export async function queryVectorize(
  vectorize: { query: (vector: number[], options: { topK: number; returnMetadata?: string }) => Promise<VectorizeQueryResult> },
  ai: { run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }> },
  question: string,
  topK = 3
): Promise<VectorizeMatch[]> {
  const embedding = await generateEmbedding(ai, question);
  const result = await vectorize.query(embedding, { topK, returnMetadata: "none" });
  return result.matches ?? [];
}

/**
 * Retrieve custom text chunks from D1 by their Vectorize IDs.
 */
export async function fetchCustomChunks(
  db: D1Database,
  vectorizeIds: string[]
): Promise<CustomSource[]> {
  if (vectorizeIds.length === 0) return [];

  const placeholders = vectorizeIds.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT id, title, author, category, content, chunk_index FROM custom_texts WHERE vectorize_id IN (${placeholders})`
    )
    .bind(...vectorizeIds)
    .all<D1CustomTextRow>();

  return results.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    category: row.category,
    content: row.content,
    chunkIndex: row.chunk_index,
  }));
}

/**
 * Full RAG pipeline: embed question → query Vectorize → fetch D1 chunks.
 * Returns top matching custom sources, or [] if Vectorize is not configured.
 */
export async function retrieveCustomSources(
  ai: { run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }> },
  vectorize: { query: (vector: number[], options: { topK: number; returnMetadata?: string }) => Promise<VectorizeQueryResult> } | null | undefined,
  db: D1Database,
  question: string,
  topK = 3
): Promise<CustomSource[]> {
  if (!vectorize) return [];

  try {
    const matches = await queryVectorize(vectorize, ai, question, topK);
    if (matches.length === 0) return [];

    const ids = matches.map((m) => m.id);
    return await fetchCustomChunks(db, ids);
  } catch (err) {
    console.error("[RAG] Failed to retrieve custom sources:", err);
    return [];
  }
}

/**
 * Chunk a long text into overlapping segments of ~wordCount words.
 * Used when ingesting custom books.
 */
export function chunkText(
  text: string,
  targetWords = 200,
  overlapWords = 50
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start += targetWords - overlapWords;
  }

  return chunks;
}
