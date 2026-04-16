/**
 * scripts/ingest-sefaria.ts
 *
 * Phase 2 du pipeline : lit le NDJSON produit par fetch-sefaria-corpus.ts,
 * embed les chunks via Gemini Embedding (1536 dim, taskType=RETRIEVAL_DOCUMENT),
 * et upsert dans Vectorize + D1 via l'API REST Cloudflare.
 *
 * Usage : tsx scripts/ingest-sefaria.ts [in=<path>] [skip=<n>] [limit=<n>]
 *
 * Requiert (.dev.vars) :
 *   - GEMINI_API_KEY
 *   - CF_API_TOKEN (scope : Workers AI Read, Vectorize Edit, D1 Edit)
 *
 * Config Cloudflare : account id + vectorize index + d1 db id (cf wrangler.jsonc).
 */
import { readFileSync, existsSync, writeFileSync } from "fs";

const CF_ACCOUNT_ID = "41de2c6559dce7a77b61dd51dbf412a3";
const VECTORIZE_INDEX = "torah-chat-sefaria";
const D1_DATABASE_ID = "f20d4bad-63ce-4a94-8049-7a6086bb7589";
const EMBEDDING_DIM = 1536;
const BATCH_SIZE_EMBED = 80; // Gemini : 250 max, on limite pour ne pas dépasser 20k tokens/req
const BATCH_SIZE_UPSERT = 100;
const PROGRESS_FILE = "scripts/ingest-sefaria.progress.json";

interface Chunk {
  id: string;
  ref: string;
  book: string;
  category: string;
  chapter: string;
  position: number;
  he: string;
  en: string | null;
  fr: string | null;
  commentary_on: string | null;
}

interface Progress {
  processed: number;
  failedRefs: string[];
}

function loadDevVars(): Record<string, string> {
  const content = readFileSync(".dev.vars", "utf-8");
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_FILE)) return { processed: 0, failedRefs: [] };
  return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")) as Progress;
}

function saveProgress(p: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------- Gemini Embedding ----------------
async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents`;
  const body = {
    requests: texts.map((t) => ({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: t }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIM,
    })),
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { embeddings: Array<{ values: number[] }> };
      return data.embeddings.map((e) => e.values);
    }
    const errText = await resp.text().catch(() => "");
    const retryable = resp.status === 429 || resp.status === 503 || resp.status === 500;
    if (!retryable || attempt === 3) {
      throw new Error(`Gemini embed ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const retryMatch = errText.match(/"retryDelay":\s*"(\d+)s"/);
    const delayMs = retryMatch ? Number(retryMatch[1]) * 1000 + 500 : (attempt + 1) * 2000;
    console.log(`[embed] retry in ${delayMs}ms (attempt ${attempt + 1})`);
    await sleep(delayMs);
  }
  throw new Error("Gemini embed: unreachable");
}

// ---------------- Cloudflare Vectorize ----------------
interface VectorizeUpsertVector {
  id: string;
  values: number[];
  metadata: Record<string, string | number>;
}

async function vectorizeUpsert(
  cfToken: string,
  vectors: VectorizeUpsertVector[]
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/upsert`;
  // NDJSON body
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfToken}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Vectorize upsert ${resp.status}: ${err.slice(0, 400)}`);
  }
}

// ---------------- Cloudflare D1 ----------------
async function d1Batch(cfToken: string, statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  // D1 REST API expects a single sql + params, or use query endpoint with multiple via semi-colon
  // We'll send one statement at a time batched via raw API
  for (const stmt of statements) {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: stmt.sql, params: stmt.params ?? [] }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`D1 ${resp.status}: ${err.slice(0, 400)}`);
    }
  }
}

async function d1InsertChunks(cfToken: string, chunks: Chunk[]): Promise<void> {
  // D1 a une limite de 100 params par query. Chaque chunk = 10 cols → 10 chunks max.
  if (chunks.length === 0) return;

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;
  const D1_CHUNK_SIZE = 10; // 10 chunks × 10 cols = 100 params, pile la limite

  for (let s = 0; s < chunks.length; s += D1_CHUNK_SIZE) {
    const slice = chunks.slice(s, s + D1_CHUNK_SIZE);
    const placeholders = slice.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params: unknown[] = [];
    for (const c of slice) {
      params.push(c.id, c.ref, c.book, c.category, c.chapter, c.position, c.he, c.en, c.fr, c.commentary_on);
    }
    const sql = `INSERT OR REPLACE INTO sefaria_chunks (id, ref, book, category, chapter, position, he, en, fr, commentary_on) VALUES ${placeholders}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`D1 bulk insert ${resp.status}: ${err.slice(0, 400)}`);
    }
  }
}

// ---------------- Main ----------------
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.split("=");
      return [k, v.join("=")];
    })
  );
  const inPath = args.in ?? "scripts/sefaria-corpus.ndjson";
  const skip = args.skip ? Number(args.skip) : 0;
  const limit = args.limit ? Number(args.limit) : Infinity;

  const env = loadDevVars();
  const geminiKey = env.GEMINI_API_KEY;
  const cfToken = env.CF_API_TOKEN;
  if (!geminiKey) throw new Error("GEMINI_API_KEY missing in .dev.vars");
  if (!cfToken) throw new Error("CF_API_TOKEN missing in .dev.vars");

  if (!existsSync(inPath)) throw new Error(`Input file not found: ${inPath}`);

  const lines = readFileSync(inPath, "utf-8").split("\n").filter((l) => l.trim().length > 0);
  console.log(`[ingest] ${lines.length} chunks in ${inPath}`);

  const progress = loadProgress();
  const start = Math.max(skip, progress.processed);
  const end = Math.min(start + limit, lines.length);
  console.log(`[ingest] processing ${start} → ${end} (already processed: ${progress.processed})`);

  const tStart = Date.now();
  let processed = progress.processed;

  for (let i = start; i < end; i += BATCH_SIZE_EMBED) {
    const batchEnd = Math.min(i + BATCH_SIZE_EMBED, end);
    const batchLines = lines.slice(i, batchEnd);
    const chunks: Chunk[] = batchLines.map((l) => JSON.parse(l) as Chunk);

    // Texte à embedder : HE uniquement (optimal selon le benchmark)
    const textsToEmbed = chunks.map((c) => c.he.slice(0, 2000)); // truncate safe

    let embeddings: number[][];
    try {
      embeddings = await embedBatch(geminiKey, textsToEmbed);
    } catch (err) {
      console.error(`[ingest] embed failed at ${i}:`, (err as Error).message);
      progress.failedRefs.push(...chunks.map((c) => c.ref));
      saveProgress(progress);
      continue;
    }

    // Upsert Vectorize (en parallèle avec D1)
    const vectors: VectorizeUpsertVector[] = chunks.map((c, idx) => ({
      id: c.id,
      values: embeddings[idx]!,
      metadata: {
        ref: c.ref,
        book: c.book,
        category: c.category,
      },
    }));

    try {
      await Promise.all([
        vectorizeUpsert(cfToken, vectors),
        d1InsertChunks(cfToken, chunks),
      ]);
    } catch (err) {
      console.error(`[ingest] upsert failed at ${i}:`, (err as Error).message);
      progress.failedRefs.push(...chunks.map((c) => c.ref));
      saveProgress(progress);
      continue;
    }

    processed = batchEnd;
    progress.processed = processed;
    saveProgress(progress);

    const elapsed = (Date.now() - tStart) / 1000;
    const rate = (processed - start) / elapsed;
    const eta = (end - processed) / rate;
    console.log(
      `[ingest] ${processed}/${end} (${((processed / end) * 100).toFixed(1)}%) — rate=${rate.toFixed(1)}/s eta=${(eta / 60).toFixed(1)}min`
    );
  }

  const totalDur = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`\n[ingest] DONE — ${processed - start} chunks in ${totalDur}s`);
  console.log(`[ingest] failed: ${progress.failedRefs.length} refs (see ${PROGRESS_FILE})`);
}

main().catch((err) => {
  console.error("[ingest] FATAL:", err);
  process.exit(1);
});
