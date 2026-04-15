/**
 * /questions — Index of all published static SEO question pages.
 * Lists all questions grouped by category, linking to /questions/:slug.
 */
import type { Route } from "./+types/questions._index";
import { useLoaderData } from "react-router";

interface QuestionRow {
  slug: string;
  question: string;
  language: string;
  category: string | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;

  const { results } = await env.DB.prepare(
    `SELECT slug, question, language, category
     FROM static_questions
     WHERE published = 1
     ORDER BY category ASC, question ASC`
  ).all<QuestionRow>();

  return { questions: results };
}

export function meta() {
  return [
    { title: "Questions fréquentes sur la Torah — Torah Chat" },
    {
      name: "description",
      content:
        "Explorez les réponses aux questions les plus fréquentes sur la Torah, le Talmud, la Halakha et la tradition juive.",
    },
  ];
}

export default function QuestionsIndexPage() {
  const { questions } = useLoaderData<typeof loader>();

  // Group by category
  const grouped = questions.reduce<Record<string, QuestionRow[]>>((acc, q) => {
    const key = q.category ?? "Général";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(q);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

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
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          Questions fréquentes sur la Torah
        </h1>
        <p className="mb-8 text-gray-500 dark:text-gray-400">
          Explorez les réponses aux questions les plus fréquentes sur la Torah, le Talmud, la Halakha et la tradition juive.
        </p>

        {questions.length === 0 ? (
          <p className="text-gray-400">Aucune question disponible pour l'instant.</p>
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => (
              <section key={cat}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {cat}
                </h2>
                <ul className="space-y-2">
                  {grouped[cat]!.map((q) => (
                    <li key={q.slug}>
                      <a
                        href={`/questions/${q.slug}`}
                        className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 hover:border-blue-300 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
                      >
                        <span className="mt-0.5 text-blue-400">?</span>
                        <span>{q.question}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-800 dark:bg-blue-950/30">
          <p className="mb-3 text-base font-medium text-gray-800 dark:text-gray-200">
            Votre question n'est pas dans la liste ?
          </p>
          <a
            href="/chat"
            className="inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Poser une question à Torah Chat
          </a>
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-200 px-4 py-6 text-center dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Propulsé par{" "}
          <a href="/chat" className="text-blue-500 hover:underline">
            Torah Chat
          </a>{" "}
          — Chatbot IA avec sources rabbiniques
        </p>
      </footer>
    </div>
  );
}
