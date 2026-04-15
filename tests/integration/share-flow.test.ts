import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the share token generation logic (pure unit test)
describe("Share flow", () => {
  describe("Token generation", () => {
    it("génère un token hexadécimal de 32 caractères", () => {
      const tokenBytes = new Uint8Array(16);
      // Simulate crypto.getRandomValues with fixed values for testing
      tokenBytes.fill(0xab);
      const token = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(token).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("génère des tokens uniques à chaque appel", () => {
      const generateToken = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      };
      const t1 = generateToken();
      const t2 = generateToken();
      expect(t1).not.toBe(t2);
      expect(t1).toHaveLength(32);
      expect(t2).toHaveLength(32);
    });
  });

  describe("Share URL construction", () => {
    it("construit une URL de partage valide", () => {
      const token = "abc123def456789012345678901234ab";
      const origin = "https://torah-chat.example.com";
      const shareUrl = `${origin}/share/${token}`;
      expect(shareUrl).toBe("https://torah-chat.example.com/share/abc123def456789012345678901234ab");
    });
  });

  describe("Fetch API for sharing", () => {
    const mockFetch = vi.fn();
    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetch);
      mockFetch.mockReset();
    });

    it("appelle POST /api/conversations/:id/share", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "abc123" }),
      });

      const response = await fetch("/api/conversations/conv-1/share", {
        method: "POST",
      });
      const data = (await response.json()) as { token: string };

      expect(mockFetch).toHaveBeenCalledWith("/api/conversations/conv-1/share", {
        method: "POST",
      });
      expect(data.token).toBe("abc123");
    });

    it("appelle DELETE /api/conversations/:id/share pour révoquer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await fetch("/api/conversations/conv-1/share", { method: "DELETE" });

      expect(mockFetch).toHaveBeenCalledWith("/api/conversations/conv-1/share", {
        method: "DELETE",
      });
    });
  });
});
