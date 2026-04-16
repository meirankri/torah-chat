export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiPart {
  text: string;
}

interface GeminiCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason: string;
}

interface GeminiSearchResult {
  queries: string[];
  refs: string[];
}

const SEARCH_QUERY_SYSTEM = `Tu es un expert en textes juifs. L'utilisateur pose une question sur la Torah, le Talmud, la Halakha, la Kabbale, etc.

Ta tâche : générer des MOTS-CLÉS DE RECHERCHE et des RÉFÉRENCES DE LIVRES pour trouver des textes pertinents dans la base Sefaria.

Retourne UNIQUEMENT un JSON valide au format :
{"queries": ["reincarnation soul gilgul", "transmigration neshama"], "refs": ["HaEmunot veHaDeot", "Sha'ar HaGilgulim"]}

Règles pour "queries" (mots-clés full-text) :
- Les mots-clés doivent être en ANGLAIS (c'est la langue d'indexation de Sefaria)
- Utilise des termes hébraïques translittérés quand c'est pertinent (gilgul, teshuva, neshama, etc.)
- Maximum 3 groupes de mots-clés
- Chaque groupe = 2-4 mots-clés liés

Règles pour "refs" (noms de livres/traités) :
- Noms de livres ou traités en ANGLAIS ou translittération hébraïque tels qu'ils apparaissent sur Sefaria
- Exemples : "Shabbat", "Berakhot", "Mishneh Torah", "Zohar", "HaEmunot veHaDeot", "Sefer HaChinukh", "Sha'ar HaGilgulim", "Moreh Nevukhim", "Kuzari"
- Si tu connais un chapitre/section précis, ajoute-le : "HaEmunot veHaDeot, [Treatise VI] The Soul and Death"
- Maximum 3 références
- Si aucune référence précise n'est pertinente, retourne "refs": []

- Si tu ne trouves rien de pertinent, retourne {"queries": [], "refs": []}
- AUCUN texte explicatif, UNIQUEMENT le JSON`;

export class GeminiClient {
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(private readonly apiKey: string) {}

  async extractSearchQueries(userQuestion: string): Promise<GeminiSearchResult> {
    const empty: GeminiSearchResult = { queries: [], refs: [] };
    const url = `${this.baseUrl}/models/gemini-3.1-flash-lite-preview:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${SEARCH_QUERY_SYSTEM}\n\nQuestion: ${userQuestion}` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "unknown");
      console.error(`[Gemini] extractSearchQueries failed: status=${response.status}, body=${errorBody}`);
      return empty;
    }

    const data = (await response.json()) as {
      candidates?: GeminiCandidate[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return empty;
      const parsed = JSON.parse(jsonMatch[0]) as GeminiSearchResult;
      const result: GeminiSearchResult = {
        queries: parsed.queries ?? [],
        refs: parsed.refs ?? [],
      };
      console.log(`[Gemini] extractSearchQueries: ${result.queries.length} keyword groups, ${result.refs.length} refs:`, result);
      return result;
    } catch {
      console.error("[Gemini] extractSearchQueries: failed to parse JSON from response:", text);
      return empty;
    }
  }

  /**
   * Calls Gemini generateContent (non-streaming) and returns the full response text.
   * Uses non-streaming to avoid Miniflare/undici fetch issues in dev.
   */
  async chat(
    systemPrompt: string,
    history: GeminiMessage[],
    userMessage: string
  ): Promise<string> {
    const url = `${this.baseUrl}/models/gemini-3.1-flash-lite-preview:generateContent?key=${this.apiKey}`;

    const contents: GeminiMessage[] = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      console.error(`[GeminiClient.chat] Gemini failed: ${response.status}`, errorText);
      if (response.status === 503 || response.status === 429) {
        throw new Error("GEMINI_OVERLOADED");
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as { candidates?: GeminiCandidate[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return text;
  }
}

// ---------- Function calling types ----------

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string; items?: { type: string }; enum?: string[] }>;
    required?: string[];
  };
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

interface GeminiFunctionCallPart {
  functionCall: GeminiFunctionCall;
}

export interface GeminiFunctionResponsePart {
  functionResponse: {
    name: string;
    id?: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContentPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponsePart["functionResponse"];
}

export interface GeminiContentMessage {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export interface FunctionCallResult {
  type: "function_call";
  call: GeminiFunctionCall;
}

export interface TextResult {
  type: "text";
  text: string;
}

export type AgentStepResult = FunctionCallResult | TextResult;

// ---------- Extended GeminiClient ----------

export class GeminiAgentClient {
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  private readonly model = "gemini-2.5-flash";

  constructor(private readonly apiKey: string) {}

  /**
   * Un seul tour de function calling : envoie l'historique + tools,
   * retourne soit un function_call (le modèle veut appeler un outil),
   * soit du texte (le modèle a fini).
   */
  async step(
    systemPrompt: string,
    contents: GeminiContentMessage[],
    tools: GeminiFunctionDeclaration[]
  ): Promise<AgentStepResult> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations: tools }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`GeminiAgent ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: GeminiContentPart[] } }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];

    // Le modèle peut retourner un functionCall ou du texte
    for (const part of parts) {
      if (part.functionCall) {
        return { type: "function_call", call: part.functionCall };
      }
    }

    // Pas de function call → c'est du texte
    const text = parts.map((p) => p.text ?? "").join("");
    return { type: "text", text };
  }
}

export function chatHistoryToGemini(
  history: { role: "user" | "assistant"; content: string }[]
): GeminiMessage[] {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}
