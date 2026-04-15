/**
 * POST /api/admin/custom-texts
 * Ingests a custom Torah text: chunks it, generates embeddings via Workers AI,
 * stores vectors in Vectorize, and saves text chunks in D1.
 *
 * Protected by ADMIN_SECRET (Authorization: Bearer <secret> or ?secret= query param).
 *
 * Body (JSON):
 *   - title: string  (required)
 *   - author?: string
 *   - category?: string
 *   - language?: string  (default: "he")
 *   - content: string  (required — plain text, will be chunked)
 */
import type { Route } from "./+types/api.admin.custom-texts";
import { chunkText, generateEmbedding, DEFAULT_EMBEDDING_MODEL } from "~/application/services/rag-service";

interface IngestBody {
  title: string;
  author?: string;
  category?: string;
  language?: string;
  content: string;
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const adminSecret = (env as Record<string, string>).ADMIN_SECRET;

  // Auth check
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("Authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const providedSecret = querySecret ?? bearerSecret;

  if (!adminSecret || providedSecret !== adminSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // DELETE /api/admin/custom-texts?title=<title>
  if (request.method === "DELETE") {
    const title = url.searchParams.get("title");
    if (!title) {
      return Response.json({ error: "title query param is required" }, { status: 400 });
    }

    // Remove vectors from Vectorize if available
    const vectorize = (env as Record<string, unknown>).VECTORIZE as {
      deleteByIds: (ids: string[]) => Promise<void>;
    } | null | undefined;

    // Get all vectorize_ids for this title first
    const { results } = await env.DB.prepare(
      `SELECT vectorize_id FROM custom_texts WHERE title = ?`
    ).bind(title).all<{ vectorize_id: string }>();

    if (vectorize && results.length > 0) {
      const ids = results.map((r) => r.vectorize_id);
      try {
        await vectorize.deleteByIds(ids);
      } catch (err) {
        console.error("[Admin] Vectorize delete failed:", err);
        // Non-blocking — still delete from D1
      }
    }

    const { meta } = await env.DB.prepare(
      `DELETE FROM custom_texts WHERE title = ?`
    ).bind(title).run();

    return Response.json({ ok: true, deletedChunks: meta.changes ?? results.length });
  }

  // From here: POST

  let body: IngestBody;
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, author, category, language = "he", content } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  if (!env.AI) {
    return Response.json({ error: "Workers AI not configured" }, { status: 503 });
  }

  const vectorize = (env as Record<string, unknown>).VECTORIZE as {
    upsert: (vectors: { id: string; values: number[]; metadata?: Record<string, string> }[]) => Promise<void>;
  } | null | undefined;

  if (!vectorize) {
    return Response.json({ error: "Vectorize not configured" }, { status: 503 });
  }

  // Chunk the text
  const chunks = chunkText(content.trim(), 200, 50);
  if (chunks.length === 0) {
    return Response.json({ error: "Content produced no chunks" }, { status: 400 });
  }

  const ai = env.AI as { run: (model: string, input: { text: string[] }) => Promise<{ data: number[][] }> };
  // Allow override via EMBEDDING_MODEL env var (e.g. switch between bge-m3 and bge-base-en-v1.5)
  const embeddingModel = (env as Record<string, string>).EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  const now = new Date().toISOString();
  const insertedIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const chunkId = crypto.randomUUID();
    const vectorizeId = `custom-${chunkId}`;

    // Generate embedding
    let embedding: number[];
    try {
      embedding = await generateEmbedding(ai, chunk, embeddingModel);
    } catch (embErr) {
      console.error(`[Admin] Embedding failed for chunk ${i}:`, embErr);
      return Response.json(
        { error: `Failed to generate embedding for chunk ${i}`, insertedSoFar: insertedIds.length },
        { status: 500 }
      );
    }

    // Upsert into Vectorize
    await vectorize.upsert([
      {
        id: vectorizeId,
        values: embedding,
        metadata: { title: title.trim(), category: category ?? "" },
      },
    ]);

    // Save chunk to D1
    await env.DB.prepare(
      `INSERT INTO custom_texts (id, title, author, category, language, chunk_index, content, vectorize_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        chunkId,
        title.trim(),
        author?.trim() ?? null,
        category?.trim() ?? null,
        language,
        i,
        chunk,
        vectorizeId,
        now
      )
      .run();

    insertedIds.push(chunkId);
  }

  return Response.json(
    {
      ok: true,
      title: title.trim(),
      chunksInserted: insertedIds.length,
      ids: insertedIds,
    },
    { status: 201 }
  );
}

// GET /api/admin/custom-texts — list all ingested texts (grouped by title)
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const adminSecret = (env as Record<string, string>).ADMIN_SECRET;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("Authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const providedSecret = querySecret ?? bearerSecret;

  if (!adminSecret || providedSecret !== adminSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { results } = await env.DB.prepare(
    `SELECT title, author, category, language, COUNT(*) as chunks, MIN(created_at) as created_at
     FROM custom_texts
     GROUP BY title, author, category, language
     ORDER BY created_at DESC`
  ).all<{
    title: string;
    author: string | null;
    category: string | null;
    language: string;
    chunks: number;
    created_at: string;
  }>();

  return Response.json({ texts: results });
}
