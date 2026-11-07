/**
 * Enforce rate limit on an API request.
 * Returns HTTP 429 Response if rate limit is exceeded, or null if allowed.
 */
export async function enforceRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): Promise<Response | null> {
  const result = await checkRateLimit(key, limit, windowMs);
  if (!result.success) {
    return Response.json(
      { error: "Too many requests. Please wait and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }
  return null;
}

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateEntry = { count: number; resetAt: number };

// In-memory store with periodic cleanup
const memoryStore = new Map<string, RateEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupExpiredEntries(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && memoryStore.size < 1000) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Check rate limit using the in-memory sliding window store.
 */
function checkInMemoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const current = memoryStore.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds,
    };
  }

  current.count += 1;
  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

/**
 * Check distributed rate limit via Upstash Redis REST API when configured.
 */
async function checkDistributedLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return checkInMemoryLimit(key, limit, windowMs);
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  const redisKey = `ratelimit:${key}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, windowSeconds, "NX"],
        ["TTL", redisKey],
      ]),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Upstash returned status ${response.status}`);
    }

    const data = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const count = Number(data[0]?.result ?? 1);
    const ttlSeconds = Math.max(1, Number(data[2]?.result ?? windowSeconds));
    const now = Date.now();
    const resetAt = now + ttlSeconds * 1000;

    if (count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: ttlSeconds,
      };
    }

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
      retryAfterSeconds: ttlSeconds,
    };
  } catch (error) {
    const fallbackStrategy = process.env.RATE_LIMIT_ON_PROVIDER_ERROR ?? "memory";
    if (fallbackStrategy === "deny") {
      return {
        success: false,
        limit,
        remaining: 0,
        resetAt: Date.now() + 5000,
        retryAfterSeconds: 5,
      };
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn("[RateLimit] Distributed provider failed; falling back to memory store:", error instanceof Error ? error.message : error);
    }
    return checkInMemoryLimit(key, limit, windowMs);
  }
}

/**
 * Check rate limit for a given key.
 */
export async function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return checkDistributedLimit(key, limit, windowMs);
  }
  return checkInMemoryLimit(key, limit, windowMs);
}


/**
 * Extract trusted client IP signal from headers without blindly trusting spoofed X-Forwarded-For.
 */
export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp && isValidIp(vercelIp)) return vercelIp;

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp && isValidIp(cfIp)) return cfIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const firstIp = xff.split(",")[0]?.trim();
    if (firstIp && isValidIp(firstIp)) return firstIp;
  }

  return "127.0.0.1";
}

function isValidIp(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip);
}

/**
 * Reset memory store (used by test suites).
 */
export function _resetRateLimits(): void {
  memoryStore.clear();
}
