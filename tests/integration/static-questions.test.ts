import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for static SEO question pages:
 * - slug generation (pure function extracted for testing)
 * - admin API (POST/DELETE) authentication and validation
 * - JSON-LD meta structure
 */

// ─── Pure helpers (replicated from route for unit testing) ───────────────────

function questionToSlug(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function buildJsonLd(question: string, answer: string, sources: Array<{ ref: string; url?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer.slice(0, 500),
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
}

// ─── Slug tests ──────────────────────────────────────────────────────────────

describe("questionToSlug", () => {
  it("convertit les espaces en tirets", () => {
    expect(questionToSlug("Qu est ce que le Shabbat")).toBe("qu-est-ce-que-le-shabbat");
  });

  it("supprime les accents", () => {
    const slug = questionToSlug("Qu'est-ce que l'écriture hébraïque");
    expect(slug).not.toContain("é");
    expect(slug).not.toContain("ï");
  });

  it("tronque à 80 caractères", () => {
    const longQ = "a ".repeat(60).trim();
    expect(questionToSlug(longQ).length).toBeLessThanOrEqual(80);
  });

  it("supprime les caractères spéciaux non alphanumériques", () => {
    const slug = questionToSlug("Qu'est-ce ? La Torah !");
    expect(slug).not.toContain("'");
    expect(slug).not.toContain("?");
    expect(slug).not.toContain("!");
  });

  it("met tout en minuscules", () => {
    expect(questionToSlug("SHABBAT Torah")).toBe("shabbat-torah");
  });

  it("génère un slug valide pour une question hébraïque translittérée", () => {
    const slug = questionToSlug("Qu est ce que le Tikoun Olam");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

// ─── JSON-LD schema tests ────────────────────────────────────────────────────

describe("JSON-LD FAQ schema", () => {
  it("génère un schema FAQPage valide", () => {
    const ld = buildJsonLd("Qu'est-ce que le Shabbat ?", "Le Shabbat est...", []);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(1);
    expect(ld.mainEntity[0]!["@type"]).toBe("Question");
    expect(ld.mainEntity[0]!.acceptedAnswer["@type"]).toBe("Answer");
  });

  it("tronque la réponse à 500 caractères dans le schema", () => {
    const longAnswer = "a".repeat(600);
    const ld = buildJsonLd("Question", longAnswer, []);
    expect(ld.mainEntity[0]!.acceptedAnswer.text.length).toBeLessThanOrEqual(500);
  });

  it("inclut les citations quand des sources sont fournies", () => {
    const sources = [
      { ref: "Genèse 2:2", url: "https://sefaria.org/Genesis.2.2" },
      { ref: "Talmud Shabbat 10a" },
    ];
    const ld = buildJsonLd("Shabbat ?", "Réponse", sources);
    const answer = ld.mainEntity[0]!.acceptedAnswer as { citation?: unknown[] };
    expect(answer.citation).toHaveLength(2);
  });

  it("n'inclut pas de citation si aucune source", () => {
    const ld = buildJsonLd("Question", "Réponse", []);
    const answer = ld.mainEntity[0]!.acceptedAnswer as { citation?: unknown[] };
    expect(answer.citation).toBeUndefined();
  });

  it("inclut l'URL dans la citation quand disponible", () => {
    const sources = [{ ref: "Genesis 1:1", url: "https://sefaria.org/Genesis.1.1" }];
    const ld = buildJsonLd("Q", "A", sources);
    const answer = ld.mainEntity[0]!.acceptedAnswer as { citation: Array<{ url?: string }> };
    expect(answer.citation[0]!.url).toBe("https://sefaria.org/Genesis.1.1");
  });

  it("n'inclut pas l'URL quand absente de la source", () => {
    const sources = [{ ref: "Talmud Brachot 1a" }];
    const ld = buildJsonLd("Q", "A", sources);
    const answer = ld.mainEntity[0]!.acceptedAnswer as { citation: Array<{ url?: string }> };
    expect(answer.citation[0]!.url).toBeUndefined();
  });
});

// ─── Admin API — auth + validation ──────────────────────────────────────────

const mockPrepare = vi.fn();
const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
const mockFirst = vi.fn();

function makeDb() {
  mockPrepare.mockReturnValue({
    bind: vi.fn().mockReturnValue({
      run: mockRun,
      first: mockFirst,
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
    run: mockRun,
    all: vi.fn().mockResolvedValue({ results: [] }),
  });
  return { prepare: mockPrepare };
}

function makeContext(db: unknown) {
  return {
    cloudflare: {
      env: { DB: db, ADMIN_SECRET: "admin-secret" },
    },
  };
}

import { action, loader } from "~/routes/api.admin.static-questions";

describe("GET /api/admin/static-questions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans secret", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions");
    const res = await loader({
      request: req,
      context: makeContext(db) as Parameters<typeof loader>[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne la liste des questions avec secret valide", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret");
    const res = await loader({
      request: req,
      context: makeContext(db) as Parameters<typeof loader>[0]["context"],
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { questions: unknown[] };
    expect(Array.isArray(data.questions)).toBe(true);
  });
});

describe("POST /api/admin/static-questions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans secret", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Q", answer: "A" }),
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne 400 si question manquante", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: "Réponse" }),
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("question");
  });

  it("retourne 400 si answer manquante", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Question ?" }),
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("answer");
  });

  it("crée une question avec slug auto-généré", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Qu est ce que le Shabbat", answer: "Le septième jour." }),
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; slug: string };
    expect(data.ok).toBe(true);
    expect(data.slug).toBe("qu-est-ce-que-le-shabbat");
  });

  it("accepte un slug custom", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Question ?", answer: "Réponse", slug: "mon-slug-custom" }),
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { slug: string };
    expect(data.slug).toBe("mon-slug-custom");
  });
});

describe("DELETE /api/admin/static-questions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans secret", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?id=abc", {
      method: "DELETE",
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(401);
  });

  it("retourne 400 si id manquant", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret", {
      method: "DELETE",
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(400);
  });

  it("supprime la question et retourne ok", async () => {
    const db = makeDb();
    const req = new Request("http://localhost/api/admin/static-questions?secret=admin-secret&id=some-id", {
      method: "DELETE",
    });
    const res = await action({
      request: req,
      context: makeContext(db) as Parameters<typeof action>[0]["context"],
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
