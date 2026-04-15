/**
 * GET /api/health
 * Healthcheck endpoint. Verifies DB connectivity and returns service status.
 * Returns 200 when healthy, 503 when degraded.
 */
import type { Route } from "./+types/api.health";

interface HealthStatus {
  status: "ok" | "degraded";
  db: "ok" | "error";
  timestamp: string;
  version: string;
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const timestamp = new Date().toISOString();
  const version = (env as Record<string, string>).APP_VERSION ?? "1.0.0";

  let dbStatus: "ok" | "error" = "error";

  try {
    await env.DB.prepare("SELECT 1").first();
    dbStatus = "ok";
  } catch {
    // DB unavailable
  }

  const overallStatus: HealthStatus["status"] =
    dbStatus === "ok" ? "ok" : "degraded";

  const body: HealthStatus = {
    status: overallStatus,
    db: dbStatus,
    timestamp,
    version,
  };

  return Response.json(body, {
    status: overallStatus === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
