/**
 * scripts/fetch-sefaria-corpus.ts
 *
 * Phase 1 du pipeline d'ingestion : telecharge depuis l'API Sefaria les textes
 * du scope defini, les chunke par unite logique, et ecrit un NDJSON
 * consommable par ingest-sefaria.ts.
 *
 * Corpus couvert :
 * - Tanakh complet (Torah + Nevi'im + Ketuvim) avec Rashi
 * - Mishna 63 traites
 * - Talmud Bavli (37 traites)
 * - Rambam (Mishneh Torah) ~83 sections
 * - Shulhan Arukh (4 sections)
 *
 * Usage : tsx scripts/fetch-sefaria-corpus.ts [out=<path>] [only=<book1|book2>]
 */
import { createHash } from "crypto";
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
  category: string;       // Categorie top ("Tanakh", "Mishnah", "Talmud", "Halakha")
  withRashi?: boolean;    // Si true, fetch "Rashi on <book>" en parallele
  rashiRef?: string;      // Surcharge du nom Rashi (defaut: "Rashi on <book>")
}

interface FetchSectionResult {
  chunks: Chunk[];
  totalItems: number;     // Nombre total de versets/lignes avant filtrage
}

// ================ BOOK CONFIGURATIONS ================

const TORAH_BOOKS: BookConfig[] = [
  { book: "Genesis", category: "Tanakh", withRashi: true },
  { book: "Exodus", category: "Tanakh", withRashi: true },
  { book: "Leviticus", category: "Tanakh", withRashi: true },
  { book: "Numbers", category: "Tanakh", withRashi: true },
  { book: "Deuteronomy", category: "Tanakh", withRashi: true },
];

const NEVIIM_BOOKS: BookConfig[] = [
  "Joshua", "Judges", "I Samuel", "II Samuel", "I Kings", "II Kings",
  "Isaiah", "Jeremiah", "Ezekiel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
].map((b) => ({ book: b, category: "Tanakh", withRashi: true }));

const KETUVIM_BOOKS: BookConfig[] = [
  "Psalms", "Proverbs", "Job", "Song of Songs", "Ruth",
  "Lamentations", "Ecclesiastes", "Esther",
  "Daniel", "Ezra", "Nehemiah", "I Chronicles", "II Chronicles",
].map((b) => ({ book: b, category: "Tanakh", withRashi: true }));

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

// Deja ingere : Berakhot, Shabbat, Pesachim
const TALMUD_TRACTATES: BookConfig[] = [
  { book: "Berakhot", category: "Talmud" },
  { book: "Shabbat", category: "Talmud" },
  { book: "Pesachim", category: "Talmud" },
];

const TALMUD_REMAINING: BookConfig[] = [
  "Yoma", "Sukkah", "Beitzah", "Rosh Hashanah", "Taanit",
  "Megillah", "Moed Katan", "Chagigah",
  "Yevamot", "Ketubot", "Nedarim", "Nazir", "Sotah", "Gittin", "Kiddushin",
  "Bava Kamma", "Bava Metzia", "Bava Batra",
  "Sanhedrin", "Makkot", "Shevuot", "Avodah Zarah", "Horayot",
  "Zevachim", "Menachot", "Chullin", "Bekhorot", "Arakhin",
  "Temurah", "Keritot", "Meilah", "Tamid", "Niddah",
].map((t) => ({ book: t, category: "Talmud" }));

// Rambam — Mishneh Torah (toutes les sections)
const RAMBAM_SECTIONS: BookConfig[] = [
  // Sefer Madda
  "Foundations of the Torah", "Human Dispositions", "Torah Study",
  "Foreign Worship and Customs of the Nations", "Repentance",
  // Sefer Ahavah
  "Reading the Shema", "Prayer and the Priestly Blessing", "Tefillin, Mezuzah and the Torah Scroll",
  "Fringes", "Blessings", "Circumcision",
  // Sefer Zemanim
  "Sabbath", "Eruvin", "Rest on the Tenth of Tishrei",
  "Rest on a Holiday", "Leavened and Unleavened Bread",
  "Shofar, Sukkah and Lulav", "Sheqel Dues", "Sanctification of the New Month",
  "Fasts", "Scroll of Esther and Hanukkah",
  // Sefer Nashim
  "Marriage", "Divorce", "Levirate Marriage and Release", "Virgin Maiden",
  // Sefer Kedushah
  "Forbidden Intercourse", "Forbidden Foods", "Ritual Slaughter",
  // Sefer Haflaah
  "Oaths", "Vows", "Nazariteship", "Appraisals and Devoted Property",
  // Sefer Zeraim
  "Diverse Species", "Gifts to the Poor", "Heave Offerings",
  "Tithes", "Second Tithes and Fourth Year's Fruit",
  "First Fruits and other Gifts to Priests Outside the Sanctuary",
  "Sabbatical Year and the Jubilee",
  // Sefer Avodah
  "The Chosen Temple", "Vessels of the Sanctuary and Those who Serve Therein",
  "Admission into the Sanctuary", "Things Forbidden on the Altar",
  "Sacrificial Procedure", "Daily Offerings and Additional Offerings",
  "Sacrifices Rendered Unfit", "Service on the Day of Atonement",
  "Trespass",
  // Sefer Korbanot
  "Paschal Offering", "Festival Offering", "Firstlings",
  "Offerings for Unintentional Transgressions", "Offerings for Those with Incomplete Atonement",
  "Substitution",
  // Sefer Taharah
  "Defilement by a Corpse", "Red Heifer", "Defilement by Leprosy",
  "Those Who Defile Bed or Seat", "Other Sources of Defilement",
  "Defilement of Foods", "Vessels", "Immersion Pools",
  // Sefer Nezikin
  "Damages to Property", "Theft", "Robbery and Lost Property",
  "One Who Injures a Person or Property", "Murderer and the Preservation of Life",
  // Sefer Kinyan
  "Sales", "Ownerless Property and Gifts", "Neighbors",
  "Agents and Partners", "Slaves",
  // Sefer Mishpatim
  "Hiring", "Borrowing and Deposit", "Creditor and Debtor",
  "Plaintiff and Defendant", "Inheritances",
  // Sefer Shoftim
  "The Sanhedrin and the Penalties within their Jurisdiction",
  "Testimony", "Rebels", "Mourning", "Kings and Wars",
].map((section) => ({
  book: `Mishneh Torah, ${section}`,
  category: "Halakha",
}));

// Shulhan Arukh (4 sections)
const SHULCHAN_ARUKH_SECTIONS: BookConfig[] = [
  { book: "Shulchan Arukh, Orach Chayim", category: "Halakha" },
  { book: "Shulchan Arukh, Yoreh De'ah", category: "Halakha" },
  { book: "Shulchan Arukh, Even HaEzer", category: "Halakha" },
  { book: "Shulchan Arukh, Choshen Mishpat", category: "Halakha" },
];

const ALL_BOOKS: BookConfig[] = [
  ...TORAH_BOOKS, ...NEVIIM_BOOKS, ...KETUVIM_BOOKS,
  ...MISHNA_TRACTATES,
  ...TALMUD_TRACTATES, ...TALMUD_REMAINING,
  ...RAMBAM_SECTIONS,
  ...SHULCHAN_ARUKH_SECTIONS,
];

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

interface SchemaNode {
  depth: number;
  addressTypes: string[];
  sectionNames: string[];
  lengths: number[] | null;
  title?: string;
  nodes?: SchemaNode[];
}

interface IndexSchema {
  title: string;
  categories: string[];
  schema: SchemaNode;
}

/** Resout le schema effectif : si le schema a des nodes, prend le premier (principal). */
function resolveSchema(schema: SchemaNode): SchemaNode {
  if (schema.nodes && schema.nodes.length > 0) {
    // Prendre le noeud principal (le premier, generalement sans titre)
    return schema.nodes[0];
  }
  return schema;
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

/**
 * Decouvre le nombre de chapitres/simanim quand lengths est null.
 * Utilise une recherche binaire sur l'API Sefaria.
 */
async function discoverChapterCount(book: string, addressType: string): Promise<number> {
  let low = 1;
  let high = 1000; // max raisonnable

  // D'abord verifier que le chapitre 1 existe
  const label1 = addressType === "Talmud" ? talmudDafLabel(1) : "1";
  const first = await fetchTextV3(`${book} ${label1}`);
  if (!first) return 0;

  // Recherche binaire
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const label = addressType === "Talmud" ? talmudDafLabel(mid) : String(mid);
    const resp = await fetchWithRetry(
      `${SEFARIA_BASE}/api/v3/texts/${encodeURIComponent(`${book} ${label}`)}?version=hebrew&return_format=text_only`
    );
    await sleep(50);
    if (resp) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  console.log(`[fetch]   discovered ${low} sections for ${book}`);
  return low;
}

// ---------------- Chunking ----------------

/** UUID deterministe base sur le ref — rend le pipeline idempotent */
function deterministicId(ref: string): string {
  const hash = createHash("sha256").update(ref).digest("hex");
  // Formatte comme UUID v5-like : 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "5" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Fetch une section (ex: "Genesis.1") et retourne les chunks par verset/ligne
 * ainsi que le nombre total d'items avant filtrage (pour iterer le Rashi).
 */
async function fetchSection(
  ref: string,
  bookCfg: BookConfig,
  chapter: string
): Promise<FetchSectionResult> {
  const data = await fetchTextV3(ref);
  if (!data) return { chunks: [], totalItems: 0 };

  const heVersion = data.versions.find((v) => v.language === "he");
  const enVersion = data.versions.find((v) => v.language === "en");

  if (!heVersion) return { chunks: [], totalItems: 0 };

  const heTexts = Array.isArray(heVersion.text) ? heVersion.text : [heVersion.text];
  const enTexts = enVersion
    ? (Array.isArray(enVersion.text) ? enVersion.text : [enVersion.text])
    : [];

  const totalItems = heTexts.length;
  const chunks: Chunk[] = [];
  for (let i = 0; i < heTexts.length; i++) {
    const he = flattenText(heTexts[i]);
    if (!he || he.length < 10) continue; // skip vide/trop court
    const en = i < enTexts.length ? flattenText(enTexts[i]) : null;
    const chunkRef = `${bookCfg.book} ${chapter}:${i + 1}`;
    chunks.push({
      id: deterministicId(chunkRef),
      ref: chunkRef,
      book: bookCfg.book,
      category: bookCfg.category,
      chapter,
      position: i + 1,
      he,
      en: en && en.length > 5 ? en : null,
      fr: null,
      commentary_on: null,
    });
  }
  return { chunks, totalItems };
}

/**
 * Fetch Rashi sur un verset specifique.
 */
async function fetchRashiOnVerse(
  hostBook: BookConfig,
  chapter: string,
  verse: number
): Promise<Chunk[]> {
  const rashiBook = hostBook.rashiRef ?? `Rashi on ${hostBook.book}`;
  const ref = `${rashiBook} ${chapter}:${verse}`;
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
    const chunkRef = `${rashiBook} ${chapter}:${verse}${heTexts.length > 1 ? `:${i + 1}` : ""}`;
    chunks.push({
      id: deterministicId(chunkRef),
      ref: chunkRef,
      book: rashiBook,
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
  currentBook?: string;
  currentChapter?: number; // dernier chapitre complete (1-based index dans la boucle)
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
  // Separateur "|" pour supporter les noms avec virgules (ex: "Mishneh Torah, Repentance")
  // Usage : only=Joshua|Judges  ou  only=Mishneh Torah, Repentance|Mishneh Torah, Sabbath
  const onlyBooks = args.only ? args.only.split("|") : null;

  const progress = loadProgress();
  const booksToRun = ALL_BOOKS.filter((b) => {
    if (onlyBooks && !onlyBooks.includes(b.book)) return false;
    if (progress.doneBooks.includes(b.book)) return false;
    return true;
  });

  console.log(`[fetch] ${booksToRun.length} books to fetch (already done: ${progress.doneBooks.length})`);
  console.log(`[fetch] output: ${outPath}`);

  // Cree le fichier s'il n'existe pas
  if (!existsSync(outPath)) writeFileSync(outPath, "");

  let totalChunks = existsSync(outPath) ? countLines(outPath) : 0;
  const tStart = Date.now();

  for (const bookCfg of booksToRun) {
    const bookStart = Date.now();
    const index = await fetchIndex(bookCfg.book);
    if (!index) {
      console.warn(`[fetch] index not found: ${bookCfg.book}`);
      progress.doneBooks.push(bookCfg.book);
      delete progress.currentBook;
      delete progress.currentChapter;
      saveProgress(progress);
      continue;
    }
    const effectiveSchema = resolveSchema(index.schema);
    const nbChapters = effectiveSchema.lengths?.[0] ?? 0;
    const sectionName = effectiveSchema.sectionNames?.[0] ?? "Section";
    const addressType = effectiveSchema.addressTypes?.[0] ?? "Integer";
    // Si lengths est null, decouvrir le nombre de chapitres dynamiquement
    const maxChapters = nbChapters > 0 ? nbChapters : await discoverChapterCount(bookCfg.book, addressType);
    console.log(`[fetch] ${bookCfg.book} — ${maxChapters} ${sectionName}`);

    // Reprendre au bon chapitre si on a ete interrompu
    const startCh = (progress.currentBook === bookCfg.book && progress.currentChapter != null)
      ? progress.currentChapter + 1
      : 1;

    if (startCh > 1) {
      console.log(`[fetch]   resuming from chapter ${startCh} (${startCh - 1} already done)`);
    }

    progress.currentBook = bookCfg.book;

    let bookChunks = 0;
    for (let ch = startCh; ch <= maxChapters; ch++) {
      const chapterLabel =
        addressType === "Talmud"
          ? talmudDafLabel(ch)
          : String(ch);
      const sectionRef = `${bookCfg.book} ${chapterLabel}`;

      try {
        const { chunks, totalItems } = await fetchSection(sectionRef, bookCfg, chapterLabel);
        for (const c of chunks) {
          appendFileSync(outPath, JSON.stringify(c) + "\n");
        }
        bookChunks += chunks.length;

        // Rashi si demande (Tanakh avec withRashi)
        if (bookCfg.withRashi) {
          const verseCount = totalItems;
          for (let v = 1; v <= verseCount; v++) {
            const rashiChunks = await fetchRashiOnVerse(bookCfg, chapterLabel, v);
            for (const c of rashiChunks) {
              appendFileSync(outPath, JSON.stringify(c) + "\n");
            }
            bookChunks += rashiChunks.length;
            await sleep(50); // ne pas saturer l'API Sefaria
          }
        }
      } catch (err) {
        console.error(`[fetch] ${sectionRef} failed:`, (err as Error).message);
      }

      // Sauvegarder progress par chapitre
      progress.currentChapter = ch;
      saveProgress(progress);

      await sleep(50);
    }

    totalChunks += bookChunks;
    progress.doneBooks.push(bookCfg.book);
    delete progress.currentBook;
    delete progress.currentChapter;
    saveProgress(progress);

    const bookDur = ((Date.now() - bookStart) / 1000).toFixed(1);
    console.log(`[fetch] Done ${bookCfg.book} — ${bookChunks} chunks in ${bookDur}s (total=${totalChunks})`);
  }

  const totalDur = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`\n[fetch] DONE — ${totalChunks} total chunks in ${totalDur}s`);
  console.log(`[fetch] output: ${outPath} (${(statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

function talmudDafLabel(n: number): string {
  // n=1->"2a", n=2->"2b", n=3->"3a", n=4->"3b", ...
  const daf = Math.floor((n + 3) / 2);
  const side = n % 2 === 1 ? "a" : "b";
  return `${daf}${side}`;
}

function countLines(path: string): number {
  const content = readFileSync(path, "utf-8");
  return content.split("\n").filter((l) => l.length > 0).length;
}

main().catch((err) => {
  console.error("[fetch] FATAL:", err);
  process.exit(1);
});
