import { Elysia } from 'elysia';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';

export class RateLimitExceededError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-Memory Sliding Window Rate Limiter Store
 *
 * In multi-node horizontal scaling, this can be swapped with a Redis-backed
 * store (e.g., ioredis / Bun redis client). For single-container instances,
 * this native Map offers sub-microsecond latency.
 */
class MemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();

  constructor() {
    // Evict expired tracking buckets every 60 seconds to prevent memory leaks
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetAt) {
          this.store.delete(key);
        }
      }
    }, 60_000);
  }

  check(
    key: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (record.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: limit - record.count,
      resetAt: record.resetAt,
    };
  }
}

export const rateLimiterStore = new MemoryRateLimiter();

/**
 * Creates an Elysia beforeHandle hook to enforce rate limits on a route.
 */
export const createRateLimitGuard = (
  limit: number = 60,
  windowMs: number = 60_000,
  identifierPrefix: string = 'api'
) => {
  return ({
    request,
    set,
  }: {
    request: Request;
    set: { headers: Record<string, string | number | undefined> };
  }) => {
    // Extract client IP from proxy headers or socket address
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const key = `${identifierPrefix}:${clientIp}`;
    const result = rateLimiterStore.check(key, limit, windowMs);

    // Set standard rate limit headers
    set.headers['X-RateLimit-Limit'] = limit.toString();
    set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
    set.headers['X-RateLimit-Reset'] = Math.ceil(result.resetAt / 1000).toString();

    if (!result.allowed) {
      set.headers['Retry-After'] = Math.ceil(
        (result.resetAt - Date.now()) / 1000
      ).toString();
      throw new RateLimitExceededError();
    }
  };
};

// Preset Guards for high-risk and standard routes
export const standardApiRateLimit = createRateLimitGuard(120, 60_000, 'std');
export const sensitiveEndpointRateLimit = createRateLimitGuard(10, 60_000, 'strict'); // Auth / Checkout

/**
 * Global Security Headers Plugin
 * Attaches OWASP-recommended HTTP security headers
 */
export const securityHeadersPlugin = new Elysia({ name: 'security-headers' })
  .onRequest(({ set }) => {
    set.headers['X-Content-Type-Options'] = 'nosniff';
    set.headers['X-Frame-Options'] = 'DENY';
    set.headers['X-XSS-Protection'] = '1; mode=block';
    set.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    set.headers['Cross-Origin-Opener-Policy'] = 'same-origin';
    set.headers['Cross-Origin-Resource-Policy'] = 'same-origin';

    if (env.NODE_ENV === 'production') {
      set.headers['Strict-Transport-Security'] =
        'max-age=31536000; includeSubDomains; preload';
    }
  });
