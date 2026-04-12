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

interface GeminiSearchQuery {
  queries: string[];
}

const SEARCH_QUERY_SYSTEM = `Tu es un expert en textes juifs. L'utilisateur pose une question sur la Torah, le Talmud, la Halakha, la Kabbale, etc.

Ta tâche : générer des MOTS-CLÉS DE RECHERCHE en anglais pour trouver des textes pertinents dans la base Sefaria.

Retourne UNIQUEMENT un JSON valide au format :
{"queries": ["reincarnation soul gilgul", "transmigration neshama"]}

Règles :
- Les mots-clés doivent être en ANGLAIS (c'est la langue d'indexation de Sefaria)
- Utilise des termes hébraïques translittérés quand c'est pertinent (gilgul, teshuva, neshama, etc.)
- Maximum 3 groupes de mots-clés
- Chaque groupe = 2-4 mots-clés liés
- Si tu ne trouves rien de pertinent, retourne {"queries": []}
- AUCUN texte explicatif, UNIQUEMENT le JSON`;

export class GeminiClient {
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(private readonly apiKey: string) {}

  async extractSearchQueries(userQuestion: string): Promise<string[]> {
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
      console.error(`Gemini search query extraction failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      candidates?: GeminiCandidate[];
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]) as GeminiSearchQuery;
      return parsed.queries ?? [];
    } catch {
      console.error("Failed to parse Gemini search queries:", text);
      return [];
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
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as { candidates?: GeminiCandidate[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return text;
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
