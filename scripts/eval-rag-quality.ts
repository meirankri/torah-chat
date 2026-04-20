/**
 * scripts/eval-rag-quality.ts
 *
 * Evaluation en conditions reelles du pipeline RAG Sefaria.
 * Pose des questions de niveau avance (talmidei hakhamim) et verifie
 * que Vectorize retourne les bonnes sources.
 *
 * Usage : tsx scripts/eval-rag-quality.ts [topK=10] [minScore=0.3]
 *
 * Requiert (.dev.vars) : GEMINI_API_KEY, CF_API_TOKEN
 */
import { readFileSync } from "fs";

const CF_ACCOUNT_ID = "41de2c6559dce7a77b61dd51dbf412a3";
const VECTORIZE_INDEX = "torah-chat-sefaria";
const D1_DATABASE_ID = "f20d4bad-63ce-4a94-8049-7a6086bb7589";
const EMBEDDING_DIM = 1536;

// ==================== GOLDEN SET ====================
// Questions de niveau talmidei hakhamim avec sources attendues

interface TestCase {
  id: string;
  question: string;
  description: string;      // Ce qu'on teste
  expectedRefs: string[];   // Refs qui DOIVENT apparaitre (au moins partiellement)
  expectedBooks: string[];  // Livres qui doivent apparaitre dans les resultats
  category: string;         // Pour regrouper les stats
}

const GOLDEN_SET: TestCase[] = [
  // ============ TORAH + RASHI ============
  {
    id: "torah-1",
    question: "איפה כתוב בתורה שאסור לבשל גדי בחלב אמו",
    description: "3 occurrences de l'interdit viande/lait dans la Torah (heb)",
    expectedRefs: ["Exodus 23:19", "Exodus 34:26", "Deuteronomy 14:21"],
    expectedBooks: ["Exodus", "Deuteronomy"],
    category: "Torah",
  },
  {
    id: "torah-2",
    question: "מהי הסיבה שמשה רבנו לא נכנס לארץ ישראל לפי רש״י",
    description: "Rashi sur la faute de Moshe a Mei Meriva",
    expectedRefs: ["Numbers 20:12", "Rashi on Numbers 20"],
    expectedBooks: ["Numbers", "Rashi on Numbers"],
    category: "Torah+Rashi",
  },
  {
    id: "torah-3",
    question: "Quel est le sens de Bereshit Bara selon Rashi ? Pourquoi la Torah commence par la creation et pas par les mitsvot ?",
    description: "Rashi celebre sur Bereshit 1:1",
    expectedRefs: ["Genesis 1:1", "Rashi on Genesis 1:1"],
    expectedBooks: ["Genesis", "Rashi on Genesis"],
    category: "Torah+Rashi",
  },
  {
    id: "torah-4",
    question: "מה הפירוש של נעשה אדם בצלמנו כדמותנו ולמה נאמר בלשון רבים",
    description: "Bereshit 1:26 — pluriel 'Naasse Adam' et Rashi",
    expectedRefs: ["Genesis 1:26", "Rashi on Genesis 1:26"],
    expectedBooks: ["Genesis", "Rashi on Genesis"],
    category: "Torah+Rashi",
  },
  {
    id: "torah-5",
    question: "עין תחת עין — est-ce litteral ou compensatoire ? Quelles sources dans la Torah ?",
    description: "Ayin ta'hat ayin dans Shemot 21:24",
    expectedRefs: ["Exodus 21:24"],
    expectedBooks: ["Exodus"],
    category: "Torah",
  },

  // ============ NEVIIM ============
  {
    id: "neviim-1",
    question: "מה אמר ה׳ ליהושע כשנכנס לארץ ישראל",
    description: "Discours de Hachem a Josue ch.1",
    expectedRefs: ["Joshua 1"],
    expectedBooks: ["Joshua"],
    category: "Neviim",
  },
  {
    id: "neviim-2",
    question: "la haftara de Shabbat Hazon — les reproches de Yeshayahou a Israel",
    description: "Isaie chapitre 1 — vision et reproches",
    expectedRefs: ["Isaiah 1"],
    expectedBooks: ["Isaiah"],
    category: "Neviim",
  },
  {
    id: "neviim-3",
    question: "מהי נבואת יחזקאל על העצמות היבשות ומה המשמעות שלה",
    description: "Ezechiel 37 — vision des ossements desseches",
    expectedRefs: ["Ezekiel 37"],
    expectedBooks: ["Ezekiel"],
    category: "Neviim",
  },

  // ============ KETUVIM ============
  {
    id: "ketuvim-1",
    question: "אשת חיל מי ימצא — le texte complet du Eshet Hayil",
    description: "Mishlei 31 — femme vaillante",
    expectedRefs: ["Proverbs 31"],
    expectedBooks: ["Proverbs"],
    category: "Ketuvim",
  },
  {
    id: "ketuvim-2",
    question: "שיר השירים — la signification mystique du Cantique selon Rashi",
    description: "Shir Hashirim + Rashi",
    expectedRefs: ["Song of Songs 1"],
    expectedBooks: ["Song of Songs"],
    category: "Ketuvim",
  },
  {
    id: "ketuvim-3",
    question: "הבל הבלים הכל הבל — que dit Kohelet sur la vanite du monde",
    description: "Ecclesiaste 1 — hevel havalim",
    expectedRefs: ["Ecclesiastes 1"],
    expectedBooks: ["Ecclesiastes"],
    category: "Ketuvim",
  },
  {
    id: "ketuvim-4",
    question: "מזמור לדוד ה׳ רועי לא אחסר — le psaume 23 du roi David",
    description: "Tehilim 23 — Hashem roi",
    expectedRefs: ["Psalms 23"],
    expectedBooks: ["Psalms"],
    category: "Ketuvim",
  },

  // ============ MISHNA ============
  {
    id: "mishna-1",
    question: "מאימתי קורין את שמע בערבית — quand commence-t-on le Shema du soir",
    description: "Premiere mishna de Berakhot",
    expectedRefs: ["Mishnah Berakhot 1"],
    expectedBooks: ["Mishnah Berakhot"],
    category: "Mishna",
  },
  {
    id: "mishna-2",
    question: "אבות הנזיקין ארבעה — les 4 categories de dommages dans la Mishna",
    description: "Bava Kamma chapitre 1",
    expectedRefs: ["Mishnah Bava Kamma 1"],
    expectedBooks: ["Mishnah Bava Kamma"],
    category: "Mishna",
  },
  {
    id: "mishna-3",
    question: "les 39 melakhot interdites a Shabbat selon la Mishna",
    description: "Mishna Shabbat 7:2",
    expectedRefs: ["Mishnah Shabbat 7"],
    expectedBooks: ["Mishnah Shabbat"],
    category: "Mishna",
  },
  {
    id: "mishna-4",
    question: "הוא היה אומר אם אין אני לי מי לי — les enseignements de Hillel dans Avot",
    description: "Pirke Avot — maximes de Hillel",
    expectedRefs: ["Pirkei Avot 1"],
    expectedBooks: ["Pirkei Avot"],
    category: "Mishna",
  },

  // ============ TALMUD ============
  {
    id: "talmud-1",
    question: "la guemara sur le din de tanour shel akhnai — le four de Akhnai et la majorite en halakha",
    description: "Bava Metzia 59b — le four d'Akhnai",
    expectedRefs: ["Bava Metzia 59"],
    expectedBooks: ["Bava Metzia"],
    category: "Talmud",
  },
  {
    id: "talmud-2",
    question: "שמע ישראל ה׳ אלוהינו ה׳ אחד — la discussion talmudique sur la kavana du Shema",
    description: "Berakhot 13 — kavana dans le Shema",
    expectedRefs: ["Berakhot 1"],
    expectedBooks: ["Berakhot"],
    category: "Talmud",
  },
  {
    id: "talmud-3",
    question: "les conditions pour etre un erev rav et le traite de Sanhedrin sur les dyanim",
    description: "Sanhedrin — composition du tribunal",
    expectedRefs: ["Sanhedrin"],
    expectedBooks: ["Sanhedrin"],
    category: "Talmud",
  },
  {
    id: "talmud-4",
    question: "כל ישראל ערבים זה בזה — la arevout en droit talmudique",
    description: "Shevuot 39a — responsabilite mutuelle",
    expectedRefs: ["Shevuot 39"],
    expectedBooks: ["Shevuot"],
    category: "Talmud",
  },
  {
    id: "talmud-5",
    question: "la discussion du Talmud sur hamotsi matsa a Pessah et les dinim de la nuit du seder",
    description: "Pesachim 115-116 — seder",
    expectedRefs: ["Pesachim 11"],
    expectedBooks: ["Pesachim"],
    category: "Talmud",
  },
  {
    id: "talmud-6",
    question: "le din de pikouah nefesh le Shabbat dans la guemara Yoma",
    description: "Yoma 85 — pikouah nefesh dohe Shabbat",
    expectedRefs: ["Yoma 8"],
    expectedBooks: ["Yoma"],
    category: "Talmud",
  },

  // ============ RAMBAM ============
  {
    id: "rambam-1",
    question: "les 13 principes de foi du Rambam — yessodei hatorah",
    description: "Rambam Yessodei HaTorah chap 1",
    expectedRefs: ["Mishneh Torah, Foundations of the Torah 1"],
    expectedBooks: ["Mishneh Torah, Foundations of the Torah"],
    category: "Rambam",
  },
  {
    id: "rambam-2",
    question: "הלכות תשובה של הרמב״ם — les niveaux de techouva et le baal techouva",
    description: "Rambam Hilkhot Teshouva",
    expectedRefs: ["Mishneh Torah, Repentance"],
    expectedBooks: ["Mishneh Torah, Repentance"],
    category: "Rambam",
  },
  {
    id: "rambam-3",
    question: "les halakhot de Shabbat dans le Rambam — melakhot et toladot",
    description: "Rambam Hilkhot Shabbat",
    expectedRefs: ["Mishneh Torah, Sabbath"],
    expectedBooks: ["Mishneh Torah, Sabbath"],
    category: "Rambam",
  },
  {
    id: "rambam-4",
    question: "le Rambam sur les regles de la shehita — les 5 simanim",
    description: "Rambam Hilkhot Shehita",
    expectedRefs: ["Mishneh Torah, Ritual Slaughter"],
    expectedBooks: ["Mishneh Torah, Ritual Slaughter"],
    category: "Rambam",
  },
  {
    id: "rambam-5",
    question: "הלכות מלכים ומלחמות — le Mashiah selon le Rambam",
    description: "Rambam Hilkhot Melakhim — Mashiah",
    expectedRefs: ["Mishneh Torah, Kings and Wars"],
    expectedBooks: ["Mishneh Torah, Kings and Wars"],
    category: "Rambam",
  },

  // ============ SHULHAN ARUKH ============
  {
    id: "sa-1",
    question: "les dinim de netilat yadaim le matin dans le Shulhan Aroukh",
    description: "Orach Hayim — netilat yadaim shaharit",
    expectedRefs: ["Shulchan Arukh, Orach Chayim 4"],
    expectedBooks: ["Shulchan Arukh, Orach Chayim"],
    category: "Shulhan Arukh",
  },
  {
    id: "sa-2",
    question: "les halakhot de kashroute dans le Yoreh Deah — basar behalav",
    description: "Yoreh Deah — lois du lait et de la viande",
    expectedRefs: ["Shulchan Arukh, Yoreh De'ah 87"],
    expectedBooks: ["Shulchan Arukh, Yoreh De'ah"],
    category: "Shulhan Arukh",
  },
  {
    id: "sa-3",
    question: "hilkhot kiddoushin dans le Even HaEzer — conditions du mariage juif",
    description: "Even HaEzer — kiddoushin",
    expectedRefs: ["Shulchan Arukh, Even HaEzer"],
    expectedBooks: ["Shulchan Arukh, Even HaEzer"],
    category: "Shulhan Arukh",
  },
  {
    id: "sa-4",
    question: "les dinim de to'en veniton — preteur et emprunteur dans le Hoshen Mishpat",
    description: "Hoshen Mishpat — din torah",
    expectedRefs: ["Shulchan Arukh, Choshen Mishpat"],
    expectedBooks: ["Shulchan Arukh, Choshen Mishpat"],
    category: "Shulhan Arukh",
  },

  // ============ CROSS-CORPUS (questions complexes) ============
  {
    id: "cross-1",
    question: "le din de rodef — les sources dans la Torah, le Talmud Sanhedrin et le Rambam sur la poursuite d'un agresseur",
    description: "Sujet transversal Torah+Talmud+Rambam",
    expectedRefs: [],
    expectedBooks: ["Sanhedrin", "Mishneh Torah, Murderer and the Preservation of Life"],
    category: "Cross-corpus",
  },
  {
    id: "cross-2",
    question: "le principe de dina demalkhuta dina — la loi du royaume est la loi — sources talmudiques et halakhiques",
    description: "Nedarim 28a, Gittin 10b, Bava Kamma 113, Rambam",
    expectedRefs: [],
    expectedBooks: ["Nedarim", "Gittin", "Bava Kamma"],
    category: "Cross-corpus",
  },
  {
    id: "cross-3",
    question: "les lois du deuil — aveilout — depuis la Torah jusqu'au Shulhan Aroukh en passant par la guemara Moed Katan",
    description: "Transversal aveilout",
    expectedRefs: [],
    expectedBooks: ["Moed Katan", "Mishneh Torah, Mourning"],
    category: "Cross-corpus",
  },
];

// ==================== API CALLS ====================

function loadDevVars(): Record<string, string> {
  const content = readFileSync(".dev.vars", "utf-8");
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const resp = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: EMBEDDING_DIM,
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini embed ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

interface VectorizeResult {
  result: {
    matches: Array<{
      id: string;
      score: number;
      metadata?: Record<string, string>;
    }>;
  };
}

async function queryVectorize(
  cfToken: string,
  embedding: number[],
  topK: number
): Promise<VectorizeResult["result"]["matches"]> {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vector: embedding, topK, returnMetadata: "all" }),
    }
  );
  if (!resp.ok) throw new Error(`Vectorize query ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as VectorizeResult;
  return data.result.matches;
}

interface D1Row {
  id: string;
  ref: string;
  book: string;
  category: string;
  he: string;
}

async function fetchChunksD1(cfToken: string, ids: string[]): Promise<D1Row[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: `SELECT id, ref, book, category, substr(he, 1, 80) as he FROM sefaria_chunks WHERE id IN (${placeholders})`,
        params: ids,
      }),
    }
  );
  if (!resp.ok) throw new Error(`D1 query ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { result: Array<{ results: D1Row[] }> };
  return data.result[0]?.results ?? [];
}

// ==================== EVALUATION ====================

interface TestResult {
  id: string;
  question: string;
  category: string;
  passed: boolean;
  refHits: string[];        // refs attendues trouvees
  refMisses: string[];      // refs attendues manquantes
  bookHits: string[];       // books attendus trouves
  bookMisses: string[];     // books attendus manquants
  topResults: Array<{ ref: string; book: string; score: number; he: string }>;
}

function checkMatch(actual: string, expected: string): boolean {
  // Match partiel : "Exodus 23:19" match "Exodus 23:19"
  // "Berakhot 13a:5" match "Berakhot 1" (prefix)
  // "Mishneh Torah, Repentance 2:3" match "Mishneh Torah, Repentance"
  return actual.startsWith(expected) || actual.includes(expected);
}

async function evaluateTestCase(
  tc: TestCase,
  geminiKey: string,
  cfToken: string,
  topK: number,
  minScore: number
): Promise<TestResult> {
  const embedding = await embedQuery(geminiKey, tc.question);
  const matches = await queryVectorize(cfToken, embedding, topK);
  const filtered = matches.filter((m) => m.score >= minScore);

  const ids = filtered.map((m) => m.id);
  const chunks = await fetchChunksD1(cfToken, ids);
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));

  const topResults = filtered.map((m) => {
    const chunk = chunkMap.get(m.id);
    return {
      ref: chunk?.ref ?? m.metadata?.ref ?? "?",
      book: chunk?.book ?? m.metadata?.book ?? "?",
      score: Math.round(m.score * 1000) / 1000,
      he: chunk?.he?.slice(0, 60) ?? "",
    };
  });

  // Verifier les refs attendues
  const refHits: string[] = [];
  const refMisses: string[] = [];
  for (const expected of tc.expectedRefs) {
    const found = topResults.some((r) => checkMatch(r.ref, expected));
    if (found) refHits.push(expected);
    else refMisses.push(expected);
  }

  // Verifier les books attendus
  // "Rashi on Exodus" compte comme hit pour "Exodus" (le commentaire couvre le livre)
  const bookHits: string[] = [];
  const bookMisses: string[] = [];
  for (const expected of tc.expectedBooks) {
    const found = topResults.some(
      (r) => r.book === expected || r.book.startsWith(expected) || r.book.includes(expected)
    );
    if (found) bookHits.push(expected);
    else bookMisses.push(expected);
  }

  const passed =
    (tc.expectedRefs.length === 0 || refMisses.length === 0) &&
    (tc.expectedBooks.length === 0 || bookMisses.length === 0);

  return { id: tc.id, question: tc.question, category: tc.category, passed, refHits, refMisses, bookHits, bookMisses, topResults };
}

// ==================== MAIN ====================

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.split("=");
      return [k, v.join("=")];
    })
  );
  const topK = parseInt(args.topK ?? "10", 10);
  const minScore = parseFloat(args.minScore ?? "0.3");
  const onlyCategory = args.category ?? null;
  const onlyId = args.id ?? null;

  const vars = loadDevVars();
  const geminiKey = vars.GEMINI_API_KEY;
  const cfToken = vars.CF_API_TOKEN;
  if (!geminiKey || !cfToken) {
    console.error("Missing GEMINI_API_KEY or CF_API_TOKEN in .dev.vars");
    process.exit(1);
  }

  let testCases = GOLDEN_SET;
  if (onlyId) testCases = testCases.filter((tc) => tc.id === onlyId);
  else if (onlyCategory) testCases = testCases.filter((tc) => tc.category === onlyCategory);

  console.log(`\n=== RAG Quality Evaluation ===`);
  console.log(`topK=${topK}  minScore=${minScore}  tests=${testCases.length}\n`);

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    try {
      const result = await evaluateTestCase(tc, geminiKey, cfToken, topK, minScore);
      results.push(result);

      const status = result.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
      console.log(`${status}  [${tc.id}] ${tc.description}`);

      if (!result.passed) {
        if (result.refMisses.length > 0) {
          console.log(`       refs manquantes: ${result.refMisses.join(", ")}`);
        }
        if (result.bookMisses.length > 0) {
          console.log(`       books manquants: ${result.bookMisses.join(", ")}`);
        }
      }

      // Afficher les top 3 resultats
      for (const r of result.topResults.slice(0, 3)) {
        console.log(`       ${r.score.toFixed(3)}  ${r.ref}  ${r.he.slice(0, 50)}...`);
      }

      if (result.passed) passed++;
      else failed++;

      await sleep(100); // throttle API calls
    } catch (err) {
      console.error(`\x1b[31mERROR\x1b[0m  [${tc.id}] ${(err as Error).message}`);
      failed++;
    }
  }

  // ==================== RAPPORT ====================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTATS: ${passed}/${passed + failed} passes (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log(`${"=".repeat(60)}`);

  // Stats par categorie
  const categories = Array.from(new Set(results.map((r) => r.category)));
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const pct = Math.round((catPassed / catResults.length) * 100);
    const bar = catPassed === catResults.length ? "\x1b[32m" : "\x1b[33m";
    console.log(`  ${bar}${cat}\x1b[0m: ${catPassed}/${catResults.length} (${pct}%)`);
  }

  // Lister les echecs
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n--- Echecs detailles ---`);
    for (const f of failures) {
      console.log(`\n[${f.id}] ${f.question.slice(0, 80)}`);
      if (f.refMisses.length > 0) console.log(`  Refs manquantes: ${f.refMisses.join(", ")}`);
      if (f.bookMisses.length > 0) console.log(`  Books manquants: ${f.bookMisses.join(", ")}`);
      console.log(`  Top resultats:`);
      for (const r of f.topResults.slice(0, 5)) {
        console.log(`    ${r.score.toFixed(3)} | ${r.ref} | ${r.he.slice(0, 50)}`);
      }
    }
  }

  console.log("");
  process.exit(failed > 0 ? 1 : 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
