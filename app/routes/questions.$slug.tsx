/**
 * /questions/:slug — SEO static pages for frequently asked Torah questions.
 * Server-side rendered with JSON-LD FAQ schema, meta tags, and CTA to chat.
 */
import type { Route } from "./+types/questions.$slug";
import { useLoaderData } from "react-router";
import { Suspense, lazy } from "react";

const MarkdownRenderer = lazy(() =>
  import("~/components/MarkdownRenderer.client").then((m) => ({
    default: m.MarkdownRenderer,
  }))
);

interface StaticQuestion {
  id: string;
  slug: string;
  question: string;
  answer: string;
  language: string;
  category: string | null;
  sources_json: string | null;
  meta_description: string | null;
}

interface SourceRef {
  ref: string;
  url?: string;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const row = await env.DB.prepare(
    `SELECT id, slug, question, answer, language, category, sources_json, meta_description
     FROM static_questions
     WHERE slug = ? AND published = 1`
  )
    .bind(params.slug)
    .first<StaticQuestion>();

  if (!row) {
    throw new Response("Not found", { status: 404 });
  }

  return { question: row };
}

export function meta({ data }: Route.MetaArgs) {
  const q = (data as { question: StaticQuestion } | undefined)?.question;
  if (!q) {
    return [{ title: "Torah Chat" }];
  }

  const title = `${q.question} — Torah Chat`;
  const description =
    q.meta_description ?? q.answer.slice(0, 160).replace(/\n/g, " ");

  const sources: SourceRef[] = q.sources_json
    ? (JSON.parse(q.sources_json) as SourceRef[])
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: q.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.answer.slice(0, 500),
          ...(sources.length > 0
            ? {
                citation: sources.map((s) => ({
                  "@type": "CreativeWork",
                  name: s.ref,
                  ...(s.url ? { url: s.url } : {}),
                })),
              }
            : {}),
        },
      },
    ],
  };

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    {
      tagName: "script",
      type: "application/ld+json",
      children: JSON.stringify(jsonLd),
    },
  ];
}

export default function StaticQuestionPage() {
  const { question } = useLoaderData<typeof loader>();

  const sources: SourceRef[] = question.sources_json
    ? (JSON.parse(question.sources_json) as SourceRef[])
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <a
            href="/chat"
            className="text-lg font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Torah Chat
          </a>
          {question.category && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {question.category}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Question */}
        <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
          {question.question}
        </h1>

        {/* Answer */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
          <Suspense
            fallback={
              <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {question.answer}
              </p>
            }
          >
            <MarkdownRenderer content={question.answer} />
          </Suspense>
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Sources
            </h2>
            <ul className="space-y-2">
              {sources.map((src, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="text-blue-500">•</span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-blue-600 dark:text-blue-400"
                    >
                      {src.ref}
                    </a>
                  ) : (
                    <span>{src.ref}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-800 dark:bg-blue-950/30">
          <p className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
            Vous avez d'autres questions sur la Torah ?
          </p>
          <a
            href="/chat"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Poser une question à Torah Chat
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 px-4 py-6 text-center dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Propulsé par{" "}
          <a
            href="/chat"
            className="text-blue-500 hover:underline"
          >
            Torah Chat
          </a>{" "}
          — Chatbot IA avec sources rabbiniques
        </p>
      </footer>
    </div>
  );
}
