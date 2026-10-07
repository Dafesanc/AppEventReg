import type { NextFunction, Request, Response } from 'express';

/** Minimal in-memory fixed-window limiter. Good enough for a single Node instance. */
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

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.hit(req.ip ?? 'unknown')) return next();
      res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' });
    };
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
