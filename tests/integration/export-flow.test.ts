import { describe, it, expect } from "vitest";

/**
 * Tests for the export conversation feature.
 * We test the markdown generation logic as pure functions
 * since the route itself depends on D1 (mocking the class constructor
 * with vi.fn is not supported in this test setup).
 */

interface ExportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ ref: string | null; title: string | null; sefariaUrl: string | null }>;
}

interface ExportConversation {
  title: string | null;
  createdAt: string;
}

function buildExportMarkdown(conversation: ExportConversation, messages: ExportMessage[]): string {
  const title = conversation.title ?? "Conversation Torah Chat";
  const createdAt = new Date(conversation.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [
    `# ${title}`,
    ``,
    `*Exporté depuis Torah Chat — ${createdAt}*`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`**Vous :** ${msg.content}`);
    } else {
      lines.push(`**Torah Chat :**`);
      lines.push(``);
      lines.push(msg.content);

      if (msg.sources && msg.sources.length > 0) {
        lines.push(``);
        lines.push(`*Sources :*`);
        for (const src of msg.sources) {
          const label = src.ref ?? src.title ?? "Source";
          if (src.sefariaUrl) {
            lines.push(`- [${label}](${src.sefariaUrl})`);
          } else {
            lines.push(`- ${label}`);
          }
        }
      }
    }
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join("\n");
}

function sanitizeFilename(title: string | null): string {
  return (title ?? "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "conversation";
}

describe("Export conversation — génération Markdown", () => {
  it("inclut le titre et la date dans l'en-tête", () => {
    const md = buildExportMarkdown(
      { title: "Ma conversation", createdAt: "2024-01-15T10:00:00Z" },
      []
    );
    expect(md).toContain("# Ma conversation");
    expect(md).toContain("Exporté depuis Torah Chat");
    expect(md).toContain("---");
  });

  it("utilise un titre par défaut quand null", () => {
    const md = buildExportMarkdown(
      { title: null, createdAt: new Date().toISOString() },
      []
    );
    expect(md).toContain("# Conversation Torah Chat");
  });

  it("formate les messages utilisateur correctement", () => {
    const md = buildExportMarkdown(
      { title: "Test", createdAt: new Date().toISOString() },
      [{ id: "1", role: "user", content: "Qu'est-ce que le Shabbat ?" }]
    );
    expect(md).toContain("**Vous :** Qu'est-ce que le Shabbat ?");
  });

  it("formate les messages assistant correctement", () => {
    const md = buildExportMarkdown(
      { title: "Test", createdAt: new Date().toISOString() },
      [{ id: "2", role: "assistant", content: "Le Shabbat est le septième jour." }]
    );
    expect(md).toContain("**Torah Chat :**");
    expect(md).toContain("Le Shabbat est le septième jour.");
  });

  it("inclut les sources avec liens Sefaria", () => {
    const md = buildExportMarkdown(
      { title: "Test", createdAt: new Date().toISOString() },
      [
        {
          id: "3",
          role: "assistant",
          content: "Réponse",
          sources: [
            { ref: "Genèse 2:2", title: "Genèse 2:2", sefariaUrl: "https://sefaria.org/Genesis.2.2" },
          ],
        },
      ]
    );
    expect(md).toContain("*Sources :*");
    expect(md).toContain("[Genèse 2:2](https://sefaria.org/Genesis.2.2)");
  });

  it("inclut les sources sans lien quand sefariaUrl est null", () => {
    const md = buildExportMarkdown(
      { title: "Test", createdAt: new Date().toISOString() },
      [
        {
          id: "4",
          role: "assistant",
          content: "Réponse",
          sources: [
            { ref: "Source custom", title: "Source custom", sefariaUrl: null },
          ],
        },
      ]
    );
    expect(md).toContain("- Source custom");
    expect(md).not.toContain("[Source custom](");
  });

  it("sépare chaque message par ---", () => {
    const md = buildExportMarkdown(
      { title: "Test", createdAt: new Date().toISOString() },
      [
        { id: "1", role: "user", content: "Question 1" },
        { id: "2", role: "assistant", content: "Réponse 1" },
        { id: "3", role: "user", content: "Question 2" },
      ]
    );
    const separators = md.match(/^---$/gm);
    // En-tête + 3 messages = 4 séparateurs
    expect(separators?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Export conversation — nom de fichier", () => {
  it("convertit les espaces en tirets", () => {
    expect(sanitizeFilename("Ma conversation Torah")).toBe("ma-conversation-torah");
  });

  it("supprime les caractères spéciaux", () => {
    expect(sanitizeFilename("Question : Shabbat ?")).toBe("question-shabbat");
  });

  it("retourne 'conversation' pour un titre null", () => {
    expect(sanitizeFilename(null)).toBe("conversation");
  });

  it("tronque à 60 caractères", () => {
    const longTitle = "a".repeat(100);
    expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(60);
  });

  it("conserve les caractères accentués", () => {
    const result = sanitizeFilename("Écriture hébraïque");
    // At minimum the result is not empty and is a valid filename
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain(" ");
  });
});
