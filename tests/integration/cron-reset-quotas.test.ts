import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "~/routes/api.cron.reset-quotas";

function makeDb(changes = 5, totalCount = 10) {
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes("UPDATE")) {
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes } }),
          }),
        };
      }
      // SELECT COUNT
      return {
        first: vi.fn().mockResolvedValue({ count: totalCount }),
      };
    }),
  };
}

function makeContext(db: unknown, cronSecret?: string) {
  return {
    cloudflare: {
      env: {
        DB: db,
        ...(cronSecret ? { CRON_SECRET: cronSecret } : {}),
      },
    },
  };
}

function makeRequest(method: string, secret?: string) {
  return new Request("http://localhost/api/cron/reset-quotas", {
    method,
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

describe("POST /api/cron/reset-quotas", () => {
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
      context: makeContext(makeDb(), "my-secret") as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne 401 si le secret est incorrect", async () => {
    const res = await action({
      request: makeRequest("POST", "wrong-secret"),
      context: makeContext(makeDb(), "my-secret") as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("réinitialise les quotas et retourne le nombre de resets", async () => {
    const db = makeDb(8, 10);
    const res = await action({
      request: makeRequest("POST", "my-secret"),
      context: makeContext(db, "my-secret") as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { reset: number; skipped: number; timestamp: string };
    expect(data.reset).toBe(8);
    expect(data.skipped).toBe(2);
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("fonctionne sans CRON_SECRET configuré (dev mode)", async () => {
    const db = makeDb(3, 3);
    const res = await action({
      request: makeRequest("POST"), // no auth header
      context: makeContext(db) as Parameters<typeof action>[0]["context"], // no CRON_SECRET
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { reset: number };
    expect(data.reset).toBe(3);
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
});

// ─── Unit tests for the RAG model migration ──────────────────────────────────

import { DEFAULT_EMBEDDING_MODEL, generateEmbedding } from "~/application/services/rag-service";

describe("RAG — modèle d'embedding configurable", () => {
  it("DEFAULT_EMBEDDING_MODEL est bge-m3 (multilingue)", () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBe("@cf/baai/bge-m3");
  });

  it("generateEmbedding utilise le modèle par défaut", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] }),
    };
    await generateEmbedding(mockAi as Parameters<typeof generateEmbedding>[0], "test");
    expect(mockAi.run).toHaveBeenCalledWith(DEFAULT_EMBEDDING_MODEL, { text: ["test"] });
  });

  it("generateEmbedding accepte un modèle custom", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ data: [[0.3, 0.4]] }),
    };
    await generateEmbedding(
      mockAi as Parameters<typeof generateEmbedding>[0],
      "test",
      "@cf/baai/bge-base-en-v1.5"
    );
    expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", { text: ["test"] });
  });
});
