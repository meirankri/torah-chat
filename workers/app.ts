import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

/**
 * Dispatches a scheduled Cloudflare Workers cron trigger to the appropriate
 * internal API route by making an internal fetch with CRON_SECRET auth.
 */
async function dispatchCron(
  cronName: string,
  route: string,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const cronSecret = (env as Record<string, string>).CRON_SECRET;
  const appUrl =
    (env as Record<string, string>).APP_URL ?? "https://torah-chat.pages.dev";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cronSecret) {
    headers["Authorization"] = `Bearer ${cronSecret}`;
  }

  console.log(`[Cron] Dispatching ${cronName} → ${route}`);

  try {
    const res = await fetch(`${appUrl}${route}`, {
      method: "POST",
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Cron] ${cronName} failed ${res.status}: ${body}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`[Cron] ${cronName} OK:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[Cron] ${cronName} error:`, err);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const { cron } = event;

    // "0 9 * * *" — daily at 09:00 UTC: send trial reminder emails
    if (cron === "0 9 * * *") {
      ctx.waitUntil(dispatchCron("trial-reminders", "/api/cron/trial-reminders", env, ctx));
      return;
    }

    // "0 0 1 * *" — 1st of each month at 00:00 UTC: reset monthly question quotas
    if (cron === "0 0 1 * *") {
      ctx.waitUntil(dispatchCron("reset-quotas", "/api/cron/reset-quotas", env, ctx));
      return;
    }

    console.warn(`[Cron] Unknown cron expression: ${cron}`);
  },
} satisfies ExportedHandler<Env>;
