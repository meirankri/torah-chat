import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "~/routes/api.cron.trial-reminders";

function makeDb(users: { email: string; name: string | null }[] = []) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: users }),
      }),
    }),
  };
}

function makeEmailClient() {
  return {
    sendEmail: vi.fn().mockResolvedValue(undefined),
  };
}

function makeContext(
  db: unknown,
  options: { cronSecret?: string; brevoApiKey?: string; appUrl?: string } = {}
) {
  return {
    cloudflare: {
      env: {
        DB: db,
        ...(options.cronSecret ? { CRON_SECRET: options.cronSecret } : {}),
        ...(options.brevoApiKey ? { BREVO_API_KEY: options.brevoApiKey } : {}),
        APP_URL: options.appUrl ?? "https://torahchat.app",
      },
    },
  };
}

function makeRequest(method: string, secret?: string) {
  return new Request("http://localhost/api/cron/trial-reminders", {
    method,
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

describe("POST /api/cron/trial-reminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 405 pour les méthodes non-POST", async () => {
    const res = await action({
      request: makeRequest("GET"),
      context: makeContext(makeDb()) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(405);
  });

  it("retourne 401 si CRON_SECRET est configuré et header absent", async () => {
    const res = await action({
      request: makeRequest("POST"),
      context: makeContext(makeDb(), { cronSecret: "my-secret" }) as Parameters<
        typeof action
      >[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne 401 si le secret est incorrect", async () => {
    const res = await action({
      request: makeRequest("POST", "wrong-secret"),
      context: makeContext(makeDb(), { cronSecret: "my-secret" }) as Parameters<
        typeof action
      >[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne {sent: 0} si aucun client email configuré", async () => {
    const res = await action({
      request: makeRequest("POST"),
      context: makeContext(makeDb(), {}) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { sent: number };
    expect(data.sent).toBe(0);
  });

  it("retourne 503 si DB non configurée", async () => {
    const res = await action({
      request: makeRequest("POST"),
      context: {
        cloudflare: { env: { DB: null } },
      } as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(503);
  });

  it("fonctionne sans CRON_SECRET configuré (dev mode)", async () => {
    // Without CRON_SECRET, any request should pass auth
    const res = await action({
      request: makeRequest("POST"), // no auth header
      context: makeContext(makeDb(), {}) as Parameters<typeof action>[0]["context"],
    });
    // Should not be 401 (auth passes, but email client returns 0 sent because no BREVO_API_KEY)
    expect(res.status).not.toBe(401);
  });
});
