import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin custom-texts route logic directly
// We test the DELETE functionality via the action handler

const mockAll = vi.fn();
const mockRun = vi.fn();

function makeDb(rows: { vectorize_id: string }[] = []) {
  mockAll.mockResolvedValue({ results: rows });
  mockRun.mockResolvedValue({ meta: { changes: rows.length } });

  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: mockAll,
        run: mockRun,
      }),
    }),
  };
}

function makeRequest(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer admin-secret",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeContext(db: unknown, vectorize?: unknown) {
  return {
    cloudflare: {
      env: {
        DB: db,
        ADMIN_SECRET: "admin-secret",
        VECTORIZE: vectorize,
        AI: { run: vi.fn() },
      },
    },
  };
}

import { action } from "~/routes/api.admin.custom-texts";

describe("DELETE /api/admin/custom-texts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne 401 sans secret admin", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/custom-texts?title=Torah", {
      method: "DELETE",
    });

    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(401);
  });

  it("retourne 400 si title manquant", async () => {
    const db = makeDb();
    const req = makeRequest("DELETE", "http://localhost/api/admin/custom-texts");

    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("title");
  });

  it("supprime les chunks D1 pour le titre donné", async () => {
    const rows = [{ vectorize_id: "custom-123" }, { vectorize_id: "custom-456" }];
    const db = makeDb(rows);

    const req = makeRequest(
      "DELETE",
      "http://localhost/api/admin/custom-texts?title=Tanya"
    );

    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; deletedChunks: number };
    expect(data.ok).toBe(true);
  });

  it("tente de supprimer les vecteurs Vectorize si configuré", async () => {
    const rows = [{ vectorize_id: "custom-aaa" }];
    const db = makeDb(rows);
    const mockDeleteByIds = vi.fn().mockResolvedValue(undefined);
    const vectorize = { deleteByIds: mockDeleteByIds };

    const req = makeRequest(
      "DELETE",
      "http://localhost/api/admin/custom-texts?title=TestText"
    );

    await action({
      request: req,
      context: makeContext(db, vectorize) as Parameters<typeof action>[0]["context"],
    });

    expect(mockDeleteByIds).toHaveBeenCalledWith(["custom-aaa"]);
  });

  it("supprime depuis D1 même si Vectorize échoue", async () => {
    const rows = [{ vectorize_id: "custom-err" }];
    const db = makeDb(rows);
    const vectorize = { deleteByIds: vi.fn().mockRejectedValue(new Error("Vectorize down")) };

    const req = makeRequest(
      "DELETE",
      "http://localhost/api/admin/custom-texts?title=ErrorText"
    );

    // Should not throw
    const res = await action({
      request: req,
      context: makeContext(db, vectorize) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/custom-texts — validation", () => {
  it("retourne 400 si title manquant", async () => {
    const db = makeDb();
    const req = makeRequest("POST", "http://localhost/api/admin/custom-texts", {
      content: "Some content",
    });

    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("title");
  });

  it("retourne 400 si content manquant", async () => {
    const db = makeDb();
    const req = makeRequest("POST", "http://localhost/api/admin/custom-texts", {
      title: "Torah",
    });

    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("content");
  });
});
