import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── /api/health ─────────────────────────────────────────────────────────────

import { loader as healthLoader } from "~/routes/api.health";

function makeHealthContext(dbOk: boolean) {
  const dbMock = {
    prepare: vi.fn().mockReturnValue({
      first: dbOk
        ? vi.fn().mockResolvedValue({ "1": 1 })
        : vi.fn().mockRejectedValue(new Error("DB down")),
    }),
  };
  return {
    cloudflare: {
      env: {
        DB: dbMock,
        APP_VERSION: "2.0.0",
      },
    },
  };
}

describe("GET /api/health", () => {
  it("retourne 200 et status=ok quand la DB répond", async () => {
    const res = await healthLoader({
      request: new Request("http://localhost/api/health"),
      context: makeHealthContext(true) as Parameters<typeof healthLoader>[0]["context"],
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; db: string; version: string };
    expect(data.status).toBe("ok");
    expect(data.db).toBe("ok");
    expect(data.version).toBe("2.0.0");
  });

  it("retourne 503 et status=degraded quand la DB est down", async () => {
    const res = await healthLoader({
      request: new Request("http://localhost/api/health"),
      context: makeHealthContext(false) as Parameters<typeof healthLoader>[0]["context"],
    });

    expect(res.status).toBe(503);
    const data = (await res.json()) as { status: string; db: string };
    expect(data.status).toBe("degraded");
    expect(data.db).toBe("error");
  });

  it("inclut un timestamp ISO dans la réponse", async () => {
    const res = await healthLoader({
      request: new Request("http://localhost/api/health"),
      context: makeHealthContext(true) as Parameters<typeof healthLoader>[0]["context"],
    });

    const data = (await res.json()) as { timestamp: string };
    expect(() => new Date(data.timestamp)).not.toThrow();
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("ne met pas en cache la réponse", async () => {
    const res = await healthLoader({
      request: new Request("http://localhost/api/health"),
      context: makeHealthContext(true) as Parameters<typeof healthLoader>[0]["context"],
    });

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ─── /robots.txt ─────────────────────────────────────────────────────────────

import { loader as robotsLoader } from "~/routes/robots[.]txt";

describe("GET /robots.txt", () => {
  it("retourne du texte avec Content-Type text/plain", async () => {
    const res = await robotsLoader({
      request: new Request("http://torah-chat.example.com/robots.txt"),
      context: {} as Parameters<typeof robotsLoader>[0]["context"],
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
  });

  it("interdit l'accès à /admin et /api/", async () => {
    const res = await robotsLoader({
      request: new Request("http://torah-chat.example.com/robots.txt"),
      context: {} as Parameters<typeof robotsLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /api/");
  });

  it("autorise l'accès à /", async () => {
    const res = await robotsLoader({
      request: new Request("http://torah-chat.example.com/robots.txt"),
      context: {} as Parameters<typeof robotsLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain("Allow: /");
  });

  it("référence le sitemap avec l'origine correcte", async () => {
    const res = await robotsLoader({
      request: new Request("https://torahchat.app/robots.txt"),
      context: {} as Parameters<typeof robotsLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain("Sitemap: https://torahchat.app/sitemap.xml");
  });
});

// ─── /sitemap.xml ────────────────────────────────────────────────────────────

import { loader as sitemapLoader } from "~/routes/sitemap[.]xml";

function makeSitemapContext(slugs: { slug: string; updated_at: string }[]) {
  return {
    cloudflare: {
      env: {
        DB: {
          prepare: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: slugs }),
          }),
        },
      },
    },
  };
}

describe("GET /sitemap.xml", () => {
  it("retourne du XML avec Content-Type application/xml", async () => {
    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: makeSitemapContext([]) as Parameters<typeof sitemapLoader>[0]["context"],
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/xml");
  });

  it("inclut les pages statiques (/, /chat, /questions, /pricing)", async () => {
    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: makeSitemapContext([]) as Parameters<typeof sitemapLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain("<loc>https://torahchat.app/</loc>");
    expect(text).toContain("<loc>https://torahchat.app/chat</loc>");
    expect(text).toContain("<loc>https://torahchat.app/questions</loc>");
    expect(text).toContain("<loc>https://torahchat.app/pricing</loc>");
  });

  it("inclut les questions statiques publiées", async () => {
    const slugs = [
      { slug: "quest-ce-que-le-shabbat", updated_at: "2024-01-15T10:00:00Z" },
      { slug: "talmud-et-torah", updated_at: "2024-02-01T10:00:00Z" },
    ];

    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: makeSitemapContext(slugs) as Parameters<typeof sitemapLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain("/questions/quest-ce-que-le-shabbat");
    expect(text).toContain("/questions/talmud-et-torah");
  });

  it("est un XML valide avec déclaration et urlset", async () => {
    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: makeSitemapContext([]) as Parameters<typeof sitemapLoader>[0]["context"],
    });

    const text = await res.text();
    expect(text).toContain('<?xml version="1.0"');
    expect(text).toContain("<urlset");
    expect(text).toContain("</urlset>");
  });

  it("dégrade gracieusement si la table n'existe pas encore", async () => {
    const ctx = {
      cloudflare: {
        env: {
          DB: {
            prepare: vi.fn().mockReturnValue({
              all: vi.fn().mockRejectedValue(new Error("no such table")),
            }),
          },
        },
      },
    };

    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: ctx as Parameters<typeof sitemapLoader>[0]["context"],
    });

    // Should still return a valid sitemap with static pages
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<urlset");
    expect(text).toContain("/chat");
  });

  it("met en cache la réponse 1 heure", async () => {
    const res = await sitemapLoader({
      request: new Request("https://torahchat.app/sitemap.xml"),
      context: makeSitemapContext([]) as Parameters<typeof sitemapLoader>[0]["context"],
    });

    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});
