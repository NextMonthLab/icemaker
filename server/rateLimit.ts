import type { Request, Response, NextFunction } from 'express';
import { logRateLimitHit } from './securityLogger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket?.remoteAddress || 'unknown';
  return ip;
}

export function createRateLimiter(name: string, options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator = getClientIp, message = 'Too many requests' } = options;
  
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;
  
  // Clean up expired entries periodically
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(store.entries());
    for (const [key, entry] of entries) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));
  
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = store.get(key);
    
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }
    
    entry.count++;
    
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetSeconds.toString());
    
    if (entry.count > maxRequests) {
      const ip = getClientIp(req);
      const userId = (req as any).user?.id;
      logRateLimitHit(req.path, ip, userId);
      res.setHeader('Retry-After', resetSeconds.toString());
      return res.status(429).json({ message, retryAfter: resetSeconds });
    }
    
    next();
  };
}

// Pre-configured rate limiters for common use cases
export const analyticsRateLimiter = createRateLimiter('analytics', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 events per minute per IP
  message: 'Too many analytics events',
});

export const activationRateLimiter = createRateLimiter('activation', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 activate/pause requests per minute per IP
  message: 'Too many activation requests',
});

export const chatRateLimiter = createRateLimiter('chat', {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 chat messages per minute per IP
  message: 'Too many chat requests',
});
