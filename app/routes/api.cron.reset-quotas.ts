/**
 * POST /api/cron/reset-quotas
 *
 * Monthly quota reset for all users whose questionsResetAt is >30 days ago.
 * This bulk cron is more efficient than the per-user lazy reset done in
 * checkAndIncrementQuota, and ensures counters stay accurate even if a user
 * hasn't chatted in a month.
 *
 * Called by Cloudflare Workers scheduled trigger or an external cron service.
 * Protected by CRON_SECRET (Authorization: Bearer <secret>).
 *
 * Returns: { reset: number, skipped: number }
 */
import type { Route } from "./+types/api.cron.reset-quotas";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const cronSecret = (env as Record<string, string>).CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!env.DB) {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }

  // Reset all users whose counter is older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { meta } = await env.DB.prepare(
    `UPDATE users
     SET questions_this_month = 0,
         questions_reset_at = ?,
         updated_at = ?
     WHERE questions_reset_at IS NULL
        OR questions_reset_at <= ?`
  )
    .bind(now, now, thirtyDaysAgo)
    .run();

  const reset = meta.changes ?? 0;

  // Count total users to compute skipped
  const total = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM users"
  ).first<{ count: number }>();

  const skipped = (total?.count ?? 0) - reset;

  console.log(`[CronResetQuotas] Reset ${reset} users, skipped ${skipped}`);

  return Response.json({ reset, skipped, timestamp: now });
}
