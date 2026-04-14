/**
 * Simple sliding-window rate limiter using Cloudflare KV.
 * Key pattern: `ratelimit:{identifier}:{windowStart}`
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowSeconds: 60,
};

export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
  const key = `ratelimit:${identifier}:${windowStart}`;
  const resetAt = windowStart + config.windowSeconds;

  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment counter with TTL slightly beyond the window
  await kv.put(key, String(count + 1), {
    expirationTtl: config.windowSeconds + 10,
  });

  return {
    allowed: true,
    remaining: config.maxRequests - count - 1,
    resetAt,
  };
}
