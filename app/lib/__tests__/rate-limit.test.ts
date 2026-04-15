import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "../rate-limit";
import type { RateLimitConfig } from "../rate-limit";

function makeKv(currentValue: string | null = null) {
  const store = new Map<string, string>();
  if (currentValue !== null) {
    // Pre-fill with some key (actual key computed in checkRateLimit)
    // We'll use a mock that always returns the given value
  }

  return {
    get: vi.fn().mockResolvedValue(currentValue),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

const config: RateLimitConfig = { maxRequests: 5, windowSeconds: 60 };

describe("checkRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permet la requête si aucune requête précédente", async () => {
    const kv = makeKv(null);
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 0 - 1 = 4
  });

  it("incrémente le compteur KV avec TTL", async () => {
    const kv = makeKv(null);
    await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(kv.put).toHaveBeenCalledOnce();
    const [, value, options] = kv.put.mock.calls[0] as [string, string, { expirationTtl: number }];
    expect(value).toBe("1");
    expect(options.expirationTtl).toBe(70); // windowSeconds + 10
  });

  it("retourne remaining correct après N requêtes", async () => {
    const kv = makeKv("3"); // 3 requêtes déjà enregistrées
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1); // 5 - 3 - 1 = 1
  });

  it("bloque si le quota est atteint", async () => {
    const kv = makeKv("5"); // déjà 5 requêtes
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(kv.put).not.toHaveBeenCalled(); // pas d'incrémentation si bloqué
  });

  it("bloque si le quota est dépassé", async () => {
    const kv = makeKv("10"); // largement dépassé
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("utilise les valeurs par défaut si config non fournie (30 req/min)", async () => {
    const kv = makeKv(null);
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29); // 30 - 0 - 1 = 29
  });

  it("génère une clé incluant l'identifier et la fenêtre temporelle", async () => {
    const kv = makeKv(null);
    await checkRateLimit(kv as unknown as KVNamespace, "ip-192.168.1.1", config);
    const [key] = kv.get.mock.calls[0] as [string];
    expect(key).toContain("ratelimit:ip-192.168.1.1:");
    expect(key).toMatch(/^ratelimit:ip-192\.168\.1\.1:\d+$/);
  });

  it("resetAt est dans le futur", async () => {
    const kv = makeKv(null);
    const before = Math.floor(Date.now() / 1000);
    const result = await checkRateLimit(kv as unknown as KVNamespace, "user-1", config);
    expect(result.resetAt).toBeGreaterThan(before);
    expect(result.resetAt).toBeLessThanOrEqual(before + config.windowSeconds + 1);
  });
});
