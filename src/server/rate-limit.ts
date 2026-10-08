import type { Context, MiddlewareHandler } from 'hono';

/** Real client IP on Cloudflare; falls back to the proxy header (or "local") on the dev server. */
export function clientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'local'
  );
}

/**
 * Minimal in-memory fixed-window limiter. On Cloudflare each Worker instance keeps its own
 * counters, so this is best-effort throttling (enough to slow down a single abusive client),
 * not a global quota.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit and returns false when the key is over the limit. */
  hit(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.hits.size > 10_000) this.prune(now);
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= this.max;
  }

  isBlocked(key: string): boolean {
    const entry = this.hits.get(key);
    return !!entry && entry.resetAt > Date.now() && entry.count >= this.max;
  }

  middleware(): MiddlewareHandler {
    return async (c, next) => {
      if (this.hit(clientIp(c))) return next();
      return c.json({ message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, 429);
    };
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
