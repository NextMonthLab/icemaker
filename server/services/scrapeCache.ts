/**
 * In-memory cache for scraped site content
 * Reduces redundant scraping and improves performance
 *
 * TTL: 24 hours (configurable)
 * Strategy: LRU eviction when max size reached
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

export class ScrapeCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000, maxSize: number = 500) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;

    // Cleanup expired entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Get cached value if exists and not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      // Expired
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit
    entry.hitCount++;
    this.hits++;
    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set(key: string, data: T, customTtl?: number): void {
    // Evict if at capacity (LRU)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const ttl = customTtl ?? this.ttlMs;
    const now = Date.now();

    this.cache.set(key, {
      data,
      expiresAt: now + ttl,
      createdAt: now,
      hitCount: 0,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Manually invalidate a cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ScrapeCache] Cleaned up ${removed} expired entries`);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHitCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hitCount < lruHitCount) {
        lruHitCount = entry.hitCount;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      console.log(`[ScrapeCache] Evicted LRU entry: ${lruKey}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(2) + '%',
      ttlMs: this.ttlMs,
    };
  }
}

// Global cache instance for site ingestion
export const siteIngestionCache = new ScrapeCache<any>(
  24 * 60 * 60 * 1000, // 24 hours
  500 // Max 500 cached sites
);

// Global cache instance for site identity extraction
export const siteIdentityCache = new ScrapeCache<any>(
  48 * 60 * 60 * 1000, // 48 hours (more stable data)
  1000 // Max 1000 cached identities
);

/**
 * Generate cache key from URL (normalize www, trailing slash, protocol)
 */
export function generateCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    // Normalize: remove www, lowercase, remove trailing slash, force https
    const normalized = parsed.hostname.toLowerCase().replace(/^www\./, '')
      + parsed.pathname.replace(/\/$/, '')
      + parsed.search;
    return normalized;
  } catch {
    // Fallback to raw URL if parsing fails
    return url.toLowerCase().replace(/^www\./, '').replace(/\/$/, '');
  }
}
