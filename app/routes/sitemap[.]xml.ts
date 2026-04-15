/**
 * GET /sitemap.xml
 * Dynamic sitemap including static pages and published /questions/:slug pages.
 * Served as application/xml.
 */
import type { Route } from "./+types/sitemap[.]xml";

interface SlugRow {
  slug: string;
  updated_at: string;
}

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/chat", priority: "0.9", changefreq: "daily" },
  { loc: "/questions", priority: "0.8", changefreq: "weekly" },
  { loc: "/pricing", priority: "0.7", changefreq: "monthly" },
  { loc: "/login", priority: "0.5", changefreq: "monthly" },
  { loc: "/signup", priority: "0.5", changefreq: "monthly" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const url = new URL(request.url);
  const origin = url.origin;

  // Fetch published question slugs from D1
  let questionRows: SlugRow[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT slug, updated_at FROM static_questions WHERE published = 1 ORDER BY updated_at DESC`
    ).all<SlugRow>();
    questionRows = results;
  } catch {
    // Table may not exist yet — degrade gracefully
  }

  const today = new Date().toISOString().slice(0, 10);

  const urlEntries: string[] = [];

  // Static pages
  for (const page of STATIC_PAGES) {
    urlEntries.push(`  <url>
    <loc>${origin}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
  }

  // Dynamic question pages
  for (const row of questionRows) {
    const lastmod = row.updated_at ? row.updated_at.slice(0, 10) : today;
    urlEntries.push(`  <url>
    <loc>${origin}/questions/${row.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
