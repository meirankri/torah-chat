/**
 * scripts/fetch-sefaria-corpus.ts
 *
 * Phase 1 du pipeline d'ingestion : télécharge depuis l'API Sefaria les textes
 * du scope défini (Torah + Rashi + Mishna + 3 Talmud), les chunke par unité
 * logique, et écrit un NDJSON consommable par ingest-sefaria.ts.
 *
 * Usage : tsx scripts/fetch-sefaria-corpus.ts [out=<path>] [only=<book1,book2>]
 */
import { writeFileSync, appendFileSync, existsSync, readFileSync, statSync } from "fs";

const SEFARIA_BASE = "https://www.sefaria.org";
const OUT_DEFAULT = "scripts/sefaria-corpus.ndjson";
const PROGRESS_FILE = "scripts/sefaria-corpus.progress.json";

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

interface BookConfig {
  book: string;           // Nom canonique Sefaria (ex: "Genesis")
  category: string;       // Catégorie top ("Tanakh", "Mishnah", "Talmud")
  withRashi?: boolean;    // Si true, fetch "Rashi on <book>" en parallèle
  rashiRef?: string;      // Surcharge du nom Rashi (défaut: "Rashi on <book>")
}

const TORAH_BOOKS: BookConfig[] = [
  { book: "Genesis", category: "Tanakh", withRashi: true },
  { book: "Exodus", category: "Tanakh", withRashi: true },
  { book: "Leviticus", category: "Tanakh", withRashi: true },
  { book: "Numbers", category: "Tanakh", withRashi: true },
  { book: "Deuteronomy", category: "Tanakh", withRashi: true },
];

const MISHNA_TRACTATES: BookConfig[] = [
  "Berakhot", "Peah", "Demai", "Kilayim", "Sheviit", "Terumot", "Maasrot",
  "Maaser Sheni", "Challah", "Orlah", "Bikkurim",
  "Shabbat", "Eruvin", "Pesachim", "Shekalim", "Yoma", "Sukkah", "Beitzah",
  "Rosh Hashanah", "Ta'anit", "Megillah", "Moed Katan", "Chagigah",
  "Yevamot", "Ketubot", "Nedarim", "Nazir", "Sotah", "Gittin", "Kiddushin",
  "Bava Kamma", "Bava Metzia", "Bava Batra", "Sanhedrin", "Makkot",
  "Shevuot", "Eduyot", "Avodah Zarah", "Avot", "Horayot",
  "Zevachim", "Menachot", "Chullin", "Bekhorot", "Arakhin", "Temurah",
  "Keritot", "Meilah", "Tamid", "Middot", "Kinnim",
  "Kelim", "Oholot", "Negaim", "Parah", "Tahorot", "Mikvaot", "Niddah",
  "Makhshirin", "Zavim", "Tevul Yom", "Yadayim", "Oktzin",
].map((t) => ({
  book: t === "Avot" ? "Pirkei Avot" : `Mishnah ${t}`,
  category: "Mishnah",
}));

const TALMUD_TRACTATES: BookConfig[] = [
  { book: "Berakhot", category: "Talmud" },
  { book: "Shabbat", category: "Talmud" },
  { book: "Pesachim", category: "Talmud" },
];

const ALL_BOOKS: BookConfig[] = [...TORAH_BOOKS, ...MISHNA_TRACTATES, ...TALMUD_TRACTATES];

// ---------------- HTML / text utils ----------------
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function flattenText(text: unknown): string {
  if (typeof text === "string") return stripHtml(text);
  if (Array.isArray(text)) return text.map(flattenText).filter(Boolean).join(" ");
  return "";
}

// ---------------- Sefaria API ----------------
interface V3Response {
  ref: string;
  versions: Array<{ language: string; versionTitle: string; text: unknown }>;
  sections: number[];
}

interface IndexSchema {
  title: string;
  categories: string[];
  schema: {
    depth: number;
    addressTypes: string[];
    sectionNames: string[];
    lengths: number[];
  };
}

async function fetchWithRetry(url: string, retries = 4): Promise<Response | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (resp.ok) return resp;
      if (resp.status === 404) return null;
      if (resp.status === 429 || resp.status >= 500) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return null;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  return null;
}

async function fetchIndex(book: string): Promise<IndexSchema | null> {
  const resp = await fetchWithRetry(`${SEFARIA_BASE}/api/index/${encodeURIComponent(book)}`);
  if (!resp) return null;
  return (await resp.json()) as IndexSchema;
}

async function fetchTextV3(ref: string): Promise<V3Response | null> {
  // Force HE + EN versions
  const url = `${SEFARIA_BASE}/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew&version=english&return_format=text_only`;
  const resp = await fetchWithRetry(url);
  if (!resp) return null;
  return (await resp.json()) as V3Response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------- Chunking ----------------
function uuid(): string {
  // Simple UUID v4 compatible
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fetch une section (ex: "Genesis.1") et retourne les chunks par verset/ligne.
 */
async function fetchSection(
  ref: string,
  bookCfg: BookConfig,
  chapter: string
): Promise<Chunk[]> {
  const data = await fetchTextV3(ref);
  if (!data) return [];

  const heVersion = data.versions.find((v) => v.language === "he");
  const enVersion = data.versions.find((v) => v.language === "en");

  if (!heVersion) return [];

  const heTexts = Array.isArray(heVersion.text) ? heVersion.text : [heVersion.text];
  const enTexts = enVersion
    ? (Array.isArray(enVersion.text) ? enVersion.text : [enVersion.text])
    : [];

  const chunks: Chunk[] = [];
  for (let i = 0; i < heTexts.length; i++) {
    const he = flattenText(heTexts[i]);
    if (!he || he.length < 10) continue; // skip vide/trop court
    const en = i < enTexts.length ? flattenText(enTexts[i]) : null;
    chunks.push({
      id: uuid(),
      ref: `${bookCfg.book} ${chapter}:${i + 1}`,
      book: bookCfg.book,
      category: bookCfg.category,
      chapter,
      position: i + 1,
      he,
      en: en && en.length > 5 ? en : null,
      fr: null, // On n'a pas la traduction FR gratuite via API, on pourra l'ajouter plus tard
      commentary_on: null,
    });
  }
  return chunks;
}

/**
 * Fetch Rashi sur un verset spécifique.
 */
async function fetchRashiOnVerse(
  hostBook: BookConfig,
  chapter: string,
  verse: number
): Promise<Chunk[]> {
  const ref = `Rashi on ${hostBook.book} ${chapter}:${verse}`;
  const data = await fetchTextV3(ref);
  if (!data) return [];

  const heVersion = data.versions.find((v) => v.language === "he");
  const enVersion = data.versions.find((v) => v.language === "en");
  if (!heVersion) return [];

  // Rashi sur un verset = potentiellement plusieurs commentaires
  const heTexts = Array.isArray(heVersion.text) ? heVersion.text : [heVersion.text];
  const enTexts = enVersion
    ? (Array.isArray(enVersion.text) ? enVersion.text : [enVersion.text])
    : [];

  const chunks: Chunk[] = [];
  for (let i = 0; i < heTexts.length; i++) {
    const he = flattenText(heTexts[i]);
    if (!he || he.length < 15) continue;
    const en = i < enTexts.length ? flattenText(enTexts[i]) : null;
    chunks.push({
      id: uuid(),
      ref: `Rashi on ${hostBook.book} ${chapter}:${verse}${heTexts.length > 1 ? `:${i + 1}` : ""}`,
      book: `Rashi on ${hostBook.book}`,
      category: "Tanakh Commentary",
      chapter,
      position: verse * 100 + i, // ordering: verset * 100 + index du commentaire
      he,
      en: en && en.length > 5 ? en : null,
      fr: null,
      commentary_on: `${hostBook.book} ${chapter}:${verse}`,
    });
  }
  return chunks;
}

// ---------------- Progress tracking ----------------
interface Progress {
  doneBooks: string[];
}

function loadProgress(): Progress {
  if (!existsSync(PROGRESS_FILE)) return { doneBooks: [] };
  return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")) as Progress;
}

function saveProgress(p: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ---------------- Main ----------------
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.split("=");
      return [k, v.join("=")];
    })
  );
  const outPath = args.out ?? OUT_DEFAULT;
  const onlyBooks = args.only ? args.only.split(",") : null;

  const progress = loadProgress();
  const booksToRun = ALL_BOOKS.filter((b) => {
    if (onlyBooks && !onlyBooks.includes(b.book)) return false;
    if (progress.doneBooks.includes(b.book)) return false;
    return true;
  });

  console.log(`[ingest] ${booksToRun.length} books to fetch (already done: ${progress.doneBooks.length})`);
  console.log(`[ingest] output: ${outPath}`);

  // Crée le fichier s'il n'existe pas
  if (!existsSync(outPath)) writeFileSync(outPath, "");

  let totalChunks = existsSync(outPath) ? countLines(outPath) : 0;
  const tStart = Date.now();

  for (const bookCfg of booksToRun) {
    const bookStart = Date.now();
    const index = await fetchIndex(bookCfg.book);
    if (!index) {
      console.warn(`[ingest] index not found: ${bookCfg.book}`);
      progress.doneBooks.push(bookCfg.book);
      saveProgress(progress);
      continue;
    }
    const nbChapters = index.schema.lengths[0] ?? 0;
    console.log(`[ingest] ${bookCfg.book} — ${nbChapters} ${index.schema.sectionNames[0]}`);

    let bookChunks = 0;
    for (let ch = 1; ch <= nbChapters; ch++) {
      const chapterLabel =
        index.schema.addressTypes[0] === "Talmud"
          ? talmudDafLabel(ch)
          : String(ch);
      const sectionRef = `${bookCfg.book} ${chapterLabel}`;

      try {
        const chunks = await fetchSection(sectionRef, bookCfg, chapterLabel);
        for (const c of chunks) {
          appendFileSync(outPath, JSON.stringify(c) + "\n");
        }
        bookChunks += chunks.length;

        // Rashi si demandé (Torah uniquement)
        if (bookCfg.withRashi) {
          for (let v = 1; v <= chunks.length; v++) {
            const rashiChunks = await fetchRashiOnVerse(bookCfg, chapterLabel, v);
            for (const c of rashiChunks) {
              appendFileSync(outPath, JSON.stringify(c) + "\n");
            }
            bookChunks += rashiChunks.length;
            await sleep(50); // ne pas saturer l'API Sefaria
          }
        }
      } catch (err) {
        console.error(`[ingest] ${sectionRef} failed:`, (err as Error).message);
      }
      await sleep(50);
    }

    totalChunks += bookChunks;
    progress.doneBooks.push(bookCfg.book);
    saveProgress(progress);

    const bookDur = ((Date.now() - bookStart) / 1000).toFixed(1);
    console.log(`[ingest] ✓ ${bookCfg.book} — ${bookChunks} chunks in ${bookDur}s (total=${totalChunks})`);
  }

  const totalDur = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`\n[ingest] DONE — ${totalChunks} total chunks in ${totalDur}s`);
  console.log(`[ingest] output: ${outPath} (${(statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

function talmudDafLabel(n: number): string {
  // n=1→"2a", n=2→"2b", n=3→"3a", n=4→"3b", ...
  const daf = Math.floor((n + 3) / 2);
  const side = n % 2 === 1 ? "a" : "b";
  return `${daf}${side}`;
}

function countLines(path: string): number {
  const content = readFileSync(path, "utf-8");
  return content.split("\n").filter((l) => l.length > 0).length;
}

main().catch((err) => {
  console.error("[ingest] FATAL:", err);
  process.exit(1);
});
