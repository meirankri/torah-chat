import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrevoClient, createBrevoClient } from "../brevo-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("BrevoClient", () => {
  const config = {
    apiKey: "test-api-key",
    senderEmail: "noreply@test.com",
    senderName: "Test App",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envoie un email avec succès", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const client = new BrevoClient(config);
    await client.sendEmail({
      to: { email: "user@example.com", name: "User" },
      subject: "Test",
      htmlContent: "<p>Hello</p>",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string) as {
      sender: { email: string };
      to: { email: string }[];
      subject: string;
    };
    expect(body.sender.email).toBe("noreply@test.com");
    expect(body.to[0]?.email).toBe("user@example.com");
    expect(body.subject).toBe("Test");
  });

  it("lève une erreur si l'API retourne un status non-ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => "Bad Request" });

    const client = new BrevoClient(config);
    await expect(
      client.sendEmail({
        to: { email: "user@example.com" },
        subject: "Test",
        htmlContent: "<p>Hello</p>",
      })
    ).rejects.toThrow("Brevo API error 400");
  });
});

describe("createBrevoClient", () => {
  it("retourne null si BREVO_API_KEY absent", () => {
    const client = createBrevoClient({});
    expect(client).toBeNull();
  });

  it("retourne un BrevoClient si BREVO_API_KEY présent", () => {
    const client = createBrevoClient({ BREVO_API_KEY: "key-123" });
    expect(client).toBeInstanceOf(BrevoClient);
  });
});
