/**
 * Product Catalog Caching Layer
 *
 * Provides a low-overhead, in-memory TTL caching engine for read-heavy product catalog endpoints.
 * Architecture is designed with an adapter pattern, allowing an immediate switch to Redis
 * in multi-node clustered deployments without modifying consumer service code.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ProductCacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtlMs: number;

  constructor(defaultTtlSeconds: number = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;

    // Periodic sweep for expired cache keys every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 120_000);
  }

  /**
   * Generates a deterministic cache key for catalog query parameters.
   */
  generateKey(params: Record<string, unknown>): string {
    const sortedQuery = Object.keys(params)
      .sort()
      .map((k) => `${k}=${String(params[k])}`)
      .join('&');
    return `products:list:${sortedQuery}`;
  }

  /**
   * Retrieves an item from cache if present and not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Saves an item to cache with a specified TTL.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Targeted Cache Invalidation
   * Clears all cached catalog listings matching the "products:*" pattern.
   * Triggered when an Admin creates, updates, or deletes a product, or when
   * a product stock level shifts materially.
   */
  invalidateCatalog(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith('products:')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Purges a single product's detail cache key.
   */
  invalidateProduct(productIdOrSlug: string): void {
    this.cache.delete(`products:detail:${productIdOrSlug}`);
    this.invalidateCatalog();
  }
}

// Export singleton instance
export const productCache = new ProductCacheService(300); // 5-minute default TTL
