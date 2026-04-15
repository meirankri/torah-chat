import type { Route } from "./+types/admin";
import { useLoaderData, isRouteErrorResponse, useRouteError } from "react-router";

interface AdminStats {
  users: {
    total: number;
    byPlan: { plan: string; count: number }[];
    newLast30Days: number;
    byProvider: { provider: string; count: number }[];
  };
  conversations: {
    total: number;
    activeNotArchived: number;
  };
  messages: {
    total: number;
    thisMonth: number;
    totalQuestionsThisMonth: number;
  };
  feedback: {
    positive: number;
    negative: number;
  };
  shares: {
    total: number;
  };
  content: {
    customTexts: number;
    customChunks: number;
    staticQuestions: number;
  };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const adminSecret = (env as Record<string, string>).ADMIN_SECRET;

  // Simple bearer-token auth via Authorization header or ?secret= query param
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const authHeader = request.headers.get("Authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const providedSecret = querySecret ?? bearerSecret;

  if (!adminSecret || providedSecret !== adminSecret) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const db = env.DB;

  // Users stats
  const totalUsers = await db
    .prepare("SELECT COUNT(*) as count FROM users")
    .first<{ count: number }>();

  const byPlan = await db
    .prepare(
      "SELECT plan, COUNT(*) as count FROM users GROUP BY plan ORDER BY count DESC"
    )
    .all<{ plan: string; count: number }>();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const newLast30Days = await db
    .prepare(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= ?"
    )
    .bind(thirtyDaysAgo)
    .first<{ count: number }>();

  const byProvider = await db
    .prepare(
      "SELECT provider, COUNT(*) as count FROM users GROUP BY provider ORDER BY count DESC"
    )
    .all<{ provider: string; count: number }>();

  // Conversations stats
  const totalConversations = await db
    .prepare("SELECT COUNT(*) as count FROM conversations")
    .first<{ count: number }>();

  const activeConversations = await db
    .prepare(
      "SELECT COUNT(*) as count FROM conversations WHERE archived = 0"
    )
    .first<{ count: number }>();

  // Messages stats
  const totalMessages = await db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE role = 'user'"
    )
    .first<{ count: number }>();

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);
  const firstOfMonthStr = firstOfMonth.toISOString().slice(0, 10);

  const messagesThisMonth = await db
    .prepare(
      "SELECT COUNT(*) as count FROM messages WHERE role = 'user' AND created_at >= ?"
    )
    .bind(firstOfMonthStr)
    .first<{ count: number }>();

  const totalQuestionsThisMonth = await db
    .prepare(
      "SELECT SUM(questions_this_month) as total FROM users"
    )
    .first<{ total: number | null }>();

  // Feedback stats
  const positiveFeedback = await db
    .prepare(
      "SELECT COUNT(*) as count FROM message_feedback WHERE rating = 1"
    )
    .first<{ count: number }>();

  const negativeFeedback = await db
    .prepare(
      "SELECT COUNT(*) as count FROM message_feedback WHERE rating = -1"
    )
    .first<{ count: number }>();

  // Shares stats
  const totalShares = await db
    .prepare("SELECT COUNT(*) as count FROM shared_conversations")
    .first<{ count: number }>();

  // Content stats (RAG custom texts + SEO static questions)
  const customChunks = await db
    .prepare("SELECT COUNT(*) as count FROM custom_texts")
    .first<{ count: number }>()
    .catch(() => ({ count: 0 }));

  const customTexts = await db
    .prepare("SELECT COUNT(DISTINCT title) as count FROM custom_texts")
    .first<{ count: number }>()
    .catch(() => ({ count: 0 }));

  const staticQuestions = await db
    .prepare("SELECT COUNT(*) as count FROM static_questions WHERE published = 1")
    .first<{ count: number }>()
    .catch(() => ({ count: 0 }));

  const stats: AdminStats = {
    users: {
      total: totalUsers?.count ?? 0,
      byPlan: byPlan.results,
      newLast30Days: newLast30Days?.count ?? 0,
      byProvider: byProvider.results,
    },
    conversations: {
      total: totalConversations?.count ?? 0,
      activeNotArchived: activeConversations?.count ?? 0,
    },
    messages: {
      total: totalMessages?.count ?? 0,
      thisMonth: messagesThisMonth?.count ?? 0,
      totalQuestionsThisMonth: totalQuestionsThisMonth?.total ?? 0,
    },
    feedback: {
      positive: positiveFeedback?.count ?? 0,
      negative: negativeFeedback?.count ?? 0,
    },
    shares: {
      total: totalShares?.count ?? 0,
    },
    content: {
      customTexts: customTexts?.count ?? 0,
      customChunks: customChunks?.count ?? 0,
      staticQuestions: staticQuestions?.count ?? 0,
    },
  };

  return { stats };
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Torah Chat — Admin" }];
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
      )}
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Trial",
  standard: "Standard",
  premium: "Premium",
  expired: "Expired",
};

export default function AdminDashboard() {
  const { stats } = useLoaderData<typeof loader>();

  const feedbackTotal = stats.feedback.positive + stats.feedback.negative;
  const satisfactionRate =
    feedbackTotal > 0
      ? Math.round((stats.feedback.positive / feedbackTotal) * 100)
      : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Torah Chat — Dashboard Admin
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          Données en temps réel depuis Cloudflare D1
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Users */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Utilisateurs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={stats.users.total} />
            <StatCard
              label="Nouveaux (30j)"
              value={stats.users.newLast30Days}
            />
            {stats.users.byPlan.map((p) => (
              <StatCard
                key={p.plan}
                label={PLAN_LABELS[p.plan] ?? p.plan}
                value={p.count}
                sub={`${stats.users.total > 0 ? Math.round((p.count / stats.users.total) * 100) : 0}%`}
              />
            ))}
          </div>

          {/* By provider */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.users.byProvider.map((p) => (
              <StatCard
                key={p.provider}
                label={`Via ${p.provider}`}
                value={p.count}
              />
            ))}
          </div>
        </section>

        {/* Conversations & Messages */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Conversations & Messages
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Conversations"
              value={stats.conversations.total}
              sub={`${stats.conversations.activeNotArchived} actives`}
            />
            <StatCard
              label="Questions posées"
              value={stats.messages.total}
              sub="total"
            />
            <StatCard
              label="Questions ce mois"
              value={stats.messages.thisMonth}
              sub="messages user"
            />
          </div>
        </section>

        {/* Feedback */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Feedback
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="👍 Positifs"
              value={stats.feedback.positive}
            />
            <StatCard
              label="👎 Négatifs"
              value={stats.feedback.negative}
            />
            <StatCard
              label="Total feedbacks"
              value={feedbackTotal}
            />
            <StatCard
              label="Satisfaction"
              value={satisfactionRate !== null ? `${satisfactionRate}%` : "—"}
            />
          </div>
        </section>

        {/* Content */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Contenu
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Textes RAG"
              value={stats.content.customTexts}
              sub={`${stats.content.customChunks} chunks`}
            />
            <StatCard
              label="Pages SEO"
              value={stats.content.staticQuestions}
              sub="questions publiées"
            />
            <StatCard
              label="Liens partagés"
              value={stats.shares.total}
            />
          </div>
        </section>

        {/* Raw JSON for debugging */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Données brutes (JSON)
          </h2>
          <pre className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-700 overflow-auto dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {JSON.stringify(stats, null, 2)}
          </pre>
        </section>
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const is401 = isRouteErrorResponse(error) && error.status === 401;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center dark:bg-gray-950">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {is401 ? "Accès refusé" : "Erreur dashboard"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {is401
            ? "Vous n'avez pas accès au dashboard admin."
            : "Une erreur s'est produite lors du chargement du dashboard."}
        </p>
      </div>
    </div>
  );
}

