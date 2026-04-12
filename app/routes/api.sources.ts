import type { Route } from "./+types/api.sources";
import { SefariaClient } from "~/infrastructure/sefaria/sefaria-client";
import { mapSefariaResultsToSources } from "~/application/services/source-service";

const MAX_SOURCES = 5;

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { text: string; messageId: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, messageId, language } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }

  if (!messageId || typeof messageId !== "string") {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }

  const env = context.cloudflare.env;
  const baseUrl = env.SEFARIA_BASE_URL || "https://www.sefaria.org";
  const cacheTtl = parseInt(env.SEFARIA_CACHE_TTL_SECONDS || "86400", 10);

  const translationLang =
    language === "fr" ? "french" : language === "he" ? "hebrew" : "english";

  const client = new SefariaClient(baseUrl, env.CACHE, cacheTtl);

  try {
    const results = await client.getSourcesForText(
      text,
      translationLang,
      MAX_SOURCES
    );

    const sources = mapSefariaResultsToSources(results, messageId);

    return Response.json({ sources });
  } catch (error) {
    console.error("Sources API error:", error);
    return Response.json(
      { sources: [], error: "Sources temporarily unavailable" },
      { status: 200 }
    );
  }
}
