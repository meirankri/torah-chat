/**
 * Admin API for managing SEO static question pages.
 * Protected by ADMIN_SECRET.
 *
 * POST   /api/admin/static-questions  — create a new static question page
 * GET    /api/admin/static-questions  — list all static questions
 * DELETE /api/admin/static-questions?id=<id>  — delete by ID
 */
import type { Route } from "./+types/api.admin.static-questions";

interface StaticQuestionBody {
  slug?: string;
  question: string;
  answer: string;
  language?: string;
  category?: string;
  sources?: Array<{ ref: string; url?: string }>;
  meta_description?: string;
  published?: boolean;
}

/** Converts a question string to a URL-friendly slug */
function questionToSlug(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function checkAuth(request: Request, adminSecret: string | undefined): boolean {
  if (!adminSecret) return false;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("Authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  return (querySecret ?? bearerSecret) === adminSecret;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const adminSecret = (env as Record<string, string>).ADMIN_SECRET;

  if (!checkAuth(request, adminSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { results } = await env.DB.prepare(
    `SELECT id, slug, question, language, category, published, created_at
     FROM static_questions
     ORDER BY created_at DESC`
  ).all<{
    id: string;
    slug: string;
    question: string;
    language: string;
    category: string | null;
    published: number;
    created_at: string;
  }>();

  return Response.json({ questions: results });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const adminSecret = (env as Record<string, string>).ADMIN_SECRET;

  if (!checkAuth(request, adminSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id query param is required" }, { status: 400 });
    }
    await env.DB.prepare(`DELETE FROM static_questions WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true });
  }

  if (request.method === "POST") {
    let body: StaticQuestionBody;
    try {
      body = (await request.json()) as StaticQuestionBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { question, answer, language = "fr", category, sources, meta_description, published = true } = body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return Response.json({ error: "question is required" }, { status: 400 });
    }
    if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
      return Response.json({ error: "answer is required" }, { status: 400 });
    }

    const slug = body.slug?.trim() || questionToSlug(question.trim());
    if (!slug) {
      return Response.json({ error: "Could not generate slug from question" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourcesJson = sources && sources.length > 0 ? JSON.stringify(sources) : null;

    try {
      await env.DB.prepare(
        `INSERT INTO static_questions (id, slug, question, answer, language, category, sources_json, meta_description, published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          slug,
          question.trim(),
          answer.trim(),
          language,
          category?.trim() ?? null,
          sourcesJson,
          meta_description?.trim() ?? null,
          published ? 1 : 0,
          now,
          now
        )
        .run();
    } catch (err) {
      // Likely a UNIQUE constraint violation on slug
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE")) {
        return Response.json({ error: `Slug already exists: ${slug}` }, { status: 409 });
      }
      throw err;
    }

    return Response.json({ ok: true, id, slug }, { status: 201 });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
