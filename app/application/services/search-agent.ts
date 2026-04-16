/**
 * Agent de recherche autonome (pattern ReAct) pour Torah Chat.
 *
 * Boucle : Gemini analyse la question → choisit un outil → on exécute → Gemini évalue
 * → itère ou STOP. Max 3 itérations.
 *
 * Outils disponibles :
 *  - vectorize_search : RAG sémantique via Vectorize (Gemini Embedding 1536d)
 *  - exact_text_search : phrase hébraïque exacte via Sefaria ES
 *  - keyword_search : full-text ES via keywords EN/HE
 *  - get_text : récupère un passage précis par ref Sefaria
 */
import {
  GeminiAgentClient,
  type GeminiFunctionDeclaration,
  type GeminiContentMessage,
  type GeminiContentPart,
  type GeminiFunctionCall,
} from "~/infrastructure/gemini/gemini-client";
import { type SefariaSourceResult, SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import { embedQueryGemini, fetchSefariaChunks } from "~/application/services/sefaria-rag-service";

const MAX_ITERATIONS = 3;

// ---------- Types ----------

export interface AgentSource {
  ref: string;
  book: string;
  category: string;
  he: string;
  en: string | null;
  fr: string | null;
  commentary_on: string | null;
  origin: "vectorize" | "es-exact" | "es-keywords" | "direct-ref";
  score: number;
}

interface VectorizeMatch {
  id: string;
  score: number;
  metadata?: Record<string, string>;
}

interface VectorizeQueryResult {
  matches: VectorizeMatch[];
}

interface VectorizeBinding {
  query: (
    vector: number[],
    options: { topK: number; returnMetadata?: string; filter?: Record<string, unknown> }
  ) => Promise<VectorizeQueryResult>;
}

export interface SearchAgentDeps {
  geminiKey: string;
  vectorize: VectorizeBinding | null;
  sefaria: SefariaClient;
  db: D1Database;
}

export interface SearchAgentResult {
  sources: AgentSource[];
  iterations: number;
  reasoning: string[];
}

// ---------- Tool definitions for Gemini ----------

const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: "vectorize_search",
    description:
      "Recherche sémantique vectorielle dans le corpus Sefaria indexé (Torah, Rashi, Mishna, Talmud Berakhot/Shabbat/Pesachim). Bon pour les questions conceptuelles et thématiques. Retourne les passages les plus similaires sémantiquement.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "La requête de recherche (en français, anglais ou hébreu). Formuler de façon descriptive.",
        },
        category: {
          type: "string",
          description: "Filtrer par catégorie (optionnel). Omit pour chercher partout.",
          enum: ["Tanakh", "Tanakh Commentary", "Mishnah", "Talmud"],
        },
        top_k: {
          type: "string",
          description: "Nombre de résultats à retourner (défaut: 5, max: 15).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "exact_text_search",
    description:
      "Recherche une phrase hébraïque/araméenne EXACTE dans tout le corpus Sefaria (y compris les textes non indexés dans Vectorize). Indispensable pour trouver TOUTES les occurrences d'une phrase spécifique (ex: לא תבשל גדי בחלב אמו). Retourne tous les passages contenant cette phrase exacte.",
    parameters: {
      type: "object",
      properties: {
        hebrew_phrase: {
          type: "string",
          description: "La phrase en hébreu/araméen à rechercher (alphabet hébreu uniquement).",
        },
        category: {
          type: "string",
          description: "Filtrer par catégorie (optionnel). Ex: 'Tanakh' pour limiter à la Torah/Nevi'im/Ketuvim.",
          enum: ["Tanakh", "Talmud", "Commentary", "Midrash", "Halakhah"],
        },
      },
      required: ["hebrew_phrase"],
    },
  },
  {
    name: "keyword_search",
    description:
      "Recherche full-text par mots-clés dans tout le corpus Sefaria via Elasticsearch. Bon pour des termes techniques ou des noms propres. Les mots-clés doivent être en anglais ou en hébreu translittéré.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "string",
          description: "Mots-clés de recherche séparés par des espaces (ex: 'milk meat basar bechalav').",
        },
        category: {
          type: "string",
          description: "Filtrer par catégorie (optionnel).",
          enum: ["Tanakh", "Talmud", "Commentary", "Midrash", "Halakhah"],
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "get_text",
    description:
      "Récupère le texte complet d'un passage précis via sa référence Sefaria. Utiliser quand tu connais la référence exacte (ex: 'Exodus 23:19', 'Berakhot 2a:1', 'Rashi on Genesis 1:1').",
    parameters: {
      type: "object",
      properties: {
        ref: {
          type: "string",
          description: "La référence Sefaria exacte (ex: 'Exodus 23:19', 'Mishnah Berakhot 1:1').",
        },
      },
      required: ["ref"],
    },
  },
  {
    name: "finish",
    description:
      "Appelle cet outil quand tu as trouvé suffisamment de sources pertinentes pour répondre à la question. Fournir un résumé des sources trouvées.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Résumé de ce que tu as trouvé et pourquoi c'est suffisant.",
        },
      },
      required: ["summary"],
    },
  },
];

const SYSTEM_PROMPT = `Tu es un agent de recherche spécialisé dans les textes juifs (Torah, Talmud, Mishna, Midrash, Halakha, commentateurs).

Tu disposes d'outils pour chercher des sources. Pour chaque question de l'utilisateur :

1. ANALYSE ce que l'utilisateur cherche :
   - Un concept ou thème ? → vectorize_search
   - Toutes les occurrences d'une phrase/formule ? → exact_text_search avec la phrase en hébreu
   - Un passage précis dont tu connais la ref ? → get_text
   - Des termes techniques ? → keyword_search

2. ÉVALUE les résultats : sont-ils pertinents ? complets ?
   - Si la question demande "toutes les occurrences" ou "les sources dans la Torah", vérifie que tu as bien cherché exhaustivement
   - Si les résultats sont hors-sujet, reformule ta recherche ou utilise un autre outil

3. ITÈRE si nécessaire (max 3 recherches au total)

4. Appelle "finish" quand tu as assez de sources pertinentes.

EXEMPLES DE RAISONNEMENT :
- "Quelles sont les occurrences de l'interdiction viande/lait dans la Torah ?" → exact_text_search("לא תבשל גדי בחלב אמו", category="Tanakh")
- "Pourquoi Moché a été puni ?" → vectorize_search("punition Moché Moïse ne rentre pas en Israël eaux de Meriva")
- "Que dit la Mishna Berakhot 1:1 ?" → get_text("Mishnah Berakhot 1:1")
- "Les 39 travaux interdits le Shabbat" → vectorize_search("39 mélakhot travaux interdits shabbat", category="Mishnah")
- Si vectorize_search retourne des résultats hors-sujet → reformuler ou essayer keyword_search

IMPORTANT : Tu ne peux PAS inventer de sources. Tu ne dois appeler que les outils disponibles.`;

// ---------- Tool execution ----------

async function executeVectorizeSearch(
  deps: SearchAgentDeps,
  args: Record<string, unknown>
): Promise<{ results: AgentSource[]; summary: string }> {
  if (!deps.vectorize) return { results: [], summary: "Vectorize non disponible." };

  const query = String(args.query ?? "");
  const category = args.category ? String(args.category) : undefined;
  const topK = Math.min(Number(args.top_k ?? 5), 15);

  const embedding = await embedQueryGemini(deps.geminiKey, query);
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;

  const result = await deps.vectorize.query(embedding, {
    topK,
    returnMetadata: "all",
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const matches = (result.matches ?? []).filter((m) => m.score >= 0.4);
  if (matches.length === 0) return { results: [], summary: `Aucun résultat pour "${query}".` };

  const chunks = await fetchSefariaChunks(deps.db, matches.map((m) => m.id));

  const sources: AgentSource[] = [];
  for (const m of matches) {
    const chunk = chunks.get(m.id);
    if (!chunk) continue;
    sources.push({
      ref: chunk.ref,
      book: chunk.book,
      category: chunk.category,
      he: chunk.he,
      en: chunk.en,
      fr: chunk.fr,
      commentary_on: chunk.commentary_on,
      origin: "vectorize",
      score: m.score,
    });
  }

  return {
    results: sources,
    summary: `${sources.length} résultats sémantiques : ${sources.map((s) => s.ref).join(", ")}`,
  };
}

async function executeExactTextSearch(
  deps: SearchAgentDeps,
  args: Record<string, unknown>
): Promise<{ results: AgentSource[]; summary: string }> {
  const phrase = String(args.hebrew_phrase ?? "");
  const category = args.category ? String(args.category) : undefined;

  const sefariaResults = await deps.sefaria.searchByHebrewPhrase(phrase, {
    category,
    translationLang: "french",
    maxSources: 10,
  });

  const sources: AgentSource[] = sefariaResults.map((r) => ({
    ref: r.ref,
    book: r.category,
    category: r.category,
    he: r.textHebrew,
    en: r.translationLanguage === "english" ? r.textTranslation : null,
    fr: r.translationLanguage === "french" ? r.textTranslation : null,
    commentary_on: null,
    origin: "es-exact" as const,
    score: 1.0,
  }));

  return {
    results: sources,
    summary: sources.length > 0
      ? `${sources.length} occurrences exactes : ${sources.map((s) => s.ref).join(", ")}`
      : `Aucune occurrence de "${phrase}" trouvée.`,
  };
}

async function executeKeywordSearch(
  deps: SearchAgentDeps,
  args: Record<string, unknown>
): Promise<{ results: AgentSource[]; summary: string }> {
  const keywords = String(args.keywords ?? "").split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return { results: [], summary: "Pas de mots-clés fournis." };

  const sefariaResults = await deps.sefaria.searchByKeywords(keywords, "french", 8);

  const sources: AgentSource[] = sefariaResults.map((r) => ({
    ref: r.ref,
    book: r.category,
    category: r.category,
    he: r.textHebrew,
    en: r.translationLanguage === "english" ? r.textTranslation : null,
    fr: r.translationLanguage === "french" ? r.textTranslation : null,
    commentary_on: null,
    origin: "es-keywords" as const,
    score: 0.6,
  }));

  return {
    results: sources,
    summary: sources.length > 0
      ? `${sources.length} résultats keyword : ${sources.map((s) => s.ref).join(", ")}`
      : `Aucun résultat pour les mots-clés "${keywords.join(", ")}".`,
  };
}

async function executeGetText(
  deps: SearchAgentDeps,
  args: Record<string, unknown>
): Promise<{ results: AgentSource[]; summary: string }> {
  const ref = String(args.ref ?? "");
  const result = await deps.sefaria.getText(ref, "french");
  if (!result) return { results: [], summary: `Passage "${ref}" non trouvé.` };

  const source: AgentSource = {
    ref: result.ref,
    book: result.category,
    category: result.category,
    he: result.textHebrew,
    en: result.translationLanguage === "english" ? result.textTranslation : null,
    fr: result.translationLanguage === "french" ? result.textTranslation : null,
    commentary_on: null,
    origin: "direct-ref",
    score: 1.0,
  };

  return {
    results: [source],
    summary: `Trouvé : ${result.ref} (${result.textHebrew.slice(0, 50)}...)`,
  };
}

async function executeTool(
  deps: SearchAgentDeps,
  call: GeminiFunctionCall
): Promise<{ results: AgentSource[]; summary: string }> {
  switch (call.name) {
    case "vectorize_search":
      return executeVectorizeSearch(deps, call.args);
    case "exact_text_search":
      return executeExactTextSearch(deps, call.args);
    case "keyword_search":
      return executeKeywordSearch(deps, call.args);
    case "get_text":
      return executeGetText(deps, call.args);
    case "finish":
      return { results: [], summary: String(call.args.summary ?? "Recherche terminée.") };
    default:
      return { results: [], summary: `Outil inconnu: ${call.name}` };
  }
}

// ---------- Dedup ----------

function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedup(sources: AgentSource[]): AgentSource[] {
  const seen = new Map<string, AgentSource>();
  for (const s of sources) {
    const key = normalizeRef(s.ref);
    const existing = seen.get(key);
    if (!existing || s.score > existing.score) {
      seen.set(key, s);
    }
  }
  return [...seen.values()];
}

// ---------- Context builder ----------

export function buildAgentSourceContext(sources: AgentSource[]): string {
  if (sources.length === 0) return "";

  const exact = sources.filter((s) => s.origin === "es-exact" || s.origin === "direct-ref");
  const semantic = sources.filter((s) => s.origin === "vectorize" || s.origin === "es-keywords");

  const blocks: string[] = [];

  if (exact.length > 0) {
    const parts = exact.map((s) => {
      let text = `[${s.ref}]`;
      if (s.he) text += `\nHébreu : ${s.he}`;
      if (s.fr) text += `\nTraduction : ${s.fr}`;
      else if (s.en) text += `\nTraduction : ${s.en}`;
      return text;
    });
    blocks.push(`SOURCES EXACTES (phrase trouvée textuellement) :\n${parts.join("\n\n")}`);
  }

  if (semantic.length > 0) {
    const parts = semantic.map((s) => {
      let text = `[${s.ref}]`;
      if (s.commentary_on) text += ` (commentaire sur ${s.commentary_on})`;
      if (s.he) text += `\nHébreu : ${s.he}`;
      if (s.fr) text += `\nTraduction : ${s.fr}`;
      else if (s.en) text += `\nTraduction : ${s.en}`;
      return text;
    });
    blocks.push(`SOURCES SÉMANTIQUES (pertinence décroissante) :\n${parts.join("\n\n")}`);
  }

  return "\n\n" + blocks.join("\n\n");
}

// ---------- Main agent loop ----------

export async function searchAgent(
  deps: SearchAgentDeps,
  question: string
): Promise<SearchAgentResult> {
  const agent = new GeminiAgentClient(deps.geminiKey);
  const allSources: AgentSource[] = [];
  const reasoning: string[] = [];

  const contents: GeminiContentMessage[] = [
    { role: "user", parts: [{ text: question }] },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stepResult = await agent.step(SYSTEM_PROMPT, contents, TOOLS);

    if (stepResult.type === "text") {
      // Le modèle a répondu en texte au lieu d'un function call → il a fini
      reasoning.push(`Iteration ${i + 1}: modèle a répondu en texte (fin)`);
      break;
    }

    const { call } = stepResult;
    reasoning.push(`Iteration ${i + 1}: ${call.name}(${JSON.stringify(call.args)})`);

    // Si finish → on s'arrête
    if (call.name === "finish") {
      reasoning.push(`Agent terminé: ${call.args.summary}`);
      break;
    }

    // Exécuter l'outil
    let toolResult: { results: AgentSource[]; summary: string };
    try {
      toolResult = await executeTool(deps, call);
    } catch (err) {
      toolResult = { results: [], summary: `Erreur: ${(err as Error).message}` };
    }

    // Accumuler les sources
    allSources.push(...toolResult.results);

    // Renvoyer le résultat au modèle pour qu'il évalue
    const functionCallPart: GeminiContentPart = { functionCall: call };
    const functionResponsePart: GeminiContentPart = {
      functionResponse: {
        name: call.name,
        id: call.id,
        response: { summary: toolResult.summary, count: toolResult.results.length },
      },
    };

    contents.push({ role: "model", parts: [functionCallPart] });
    contents.push({ role: "user", parts: [functionResponsePart] });
  }

  const dedupedSources = dedup(allSources);

  // Trier : exact d'abord, puis par score décroissant
  dedupedSources.sort((a, b) => {
    const originOrder = { "es-exact": 0, "direct-ref": 1, vectorize: 2, "es-keywords": 3 };
    const aOrder = originOrder[a.origin];
    const bOrder = originOrder[b.origin];
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.score - a.score;
  });

  return {
    sources: dedupedSources.slice(0, 12),
    iterations: reasoning.length,
    reasoning,
  };
}
