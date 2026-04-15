import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Cloudflare Workers scheduled handler and cron dispatch logic.
 * We test the dispatch behavior using mocked fetch calls.
 */

// ─── Scheduled handler logic (extracted for unit testing) ────────────────────

interface DispatchOptions {
  appUrl: string;
  cronSecret?: string;
  route: string;
}

async function dispatchCronFetch(
  mockFetch: (url: string, init?: RequestInit) => Promise<Response>,
  options: DispatchOptions
): Promise<{ ok: boolean; status?: number }> {
  const { appUrl, cronSecret, route } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

  try {
    const res = await mockFetch(`${appUrl}${route}`, { method: "POST", headers });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false };
  }
}

describe("Worker scheduled handler — dispatch logic", () => {
  it("ajoute Authorization header quand CRON_SECRET est défini", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await dispatchCronFetch(mockFetch, {
      appUrl: "https://torah-chat.app",
      cronSecret: "my-secret",
      route: "/api/cron/trial-reminders",
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://torah-chat.app/api/cron/trial-reminders");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer my-secret");
  });

  it("n'ajoute pas Authorization header sans CRON_SECRET", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await dispatchCronFetch(mockFetch, {
      appUrl: "https://torah-chat.app",
      route: "/api/cron/reset-quotas",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("retourne ok:false si le fetch échoue", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await dispatchCronFetch(mockFetch, {
      appUrl: "https://torah-chat.app",
      route: "/api/cron/reset-quotas",
    });
    expect(result.ok).toBe(false);
  });

  it("retourne ok:true si la réponse est 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await dispatchCronFetch(mockFetch, {
      appUrl: "https://torah-chat.app",
      route: "/api/cron/trial-reminders",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  it("retourne ok:false si la réponse est 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    const result = await dispatchCronFetch(mockFetch, {
      appUrl: "https://torah-chat.app",
      route: "/api/cron/reset-quotas",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});

// ─── Cron expressions ─────────────────────────────────────────────────────────

describe("Cron expressions", () => {
  const CRON_TRIAL_REMINDERS = "0 9 * * *";
  const CRON_RESET_QUOTAS = "0 0 1 * *";

  function cronRoute(cron: string): string | null {
    if (cron === CRON_TRIAL_REMINDERS) return "/api/cron/trial-reminders";
    if (cron === CRON_RESET_QUOTAS) return "/api/cron/reset-quotas";
    return null;
  }

  it("0 9 * * * mappe vers trial-reminders", () => {
    expect(cronRoute("0 9 * * *")).toBe("/api/cron/trial-reminders");
  });

  it("0 0 1 * * mappe vers reset-quotas", () => {
    expect(cronRoute("0 0 1 * *")).toBe("/api/cron/reset-quotas");
  });

  it("expression inconnue retourne null", () => {
    expect(cronRoute("* * * * *")).toBeNull();
  });
});

// ─── Quota premium configurable ───────────────────────────────────────────────

import { getPlanLimit } from "~/application/services/quota-service";

describe("getPlanLimit — limites configurables", () => {
  it("free_trial retourne 50 (fixe)", () => {
    expect(getPlanLimit("free_trial", { standardLimit: 500, premiumLimit: 2000 })).toBe(50);
  });

  it("standard retourne standardLimit", () => {
    expect(getPlanLimit("standard", { standardLimit: 300, premiumLimit: 2000 })).toBe(300);
  });

  it("premium retourne premiumLimit", () => {
    expect(getPlanLimit("premium", { standardLimit: 500, premiumLimit: 5000 })).toBe(5000);
  });

  it("expired retourne 0", () => {
    expect(getPlanLimit("expired", { standardLimit: 500, premiumLimit: 2000 })).toBe(0);
  });

  it("utilise les valeurs par défaut si config non fournie", () => {
    // DEFAULT_QUOTA: standard=500, premium=2000
    expect(getPlanLimit("standard")).toBe(500);
    expect(getPlanLimit("premium")).toBe(2000);
  });

  it("premium limit est maintenant configurable via wrangler var", () => {
    // Simulate reading from env: PLAN_PREMIUM_QUESTIONS_LIMIT=3000
    const premiumLimit = parseInt("3000", 10);
    expect(getPlanLimit("premium", { standardLimit: 500, premiumLimit })).toBe(3000);
  });
});
