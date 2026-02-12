import logger from "./logger";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  key: string;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  name?: string;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private name: string;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000;
    this.name = options.name || "default";
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      key,
    });
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      name: this.name,
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "N/A",
    };
  }

  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

export const settingsCache = new LRUCache<unknown>({ maxSize: 100, defaultTTL: 5 * 60 * 1000, name: "settings" });
export const userCache = new LRUCache<unknown>({ maxSize: 500, defaultTTL: 2 * 60 * 1000, name: "users" });
export const jobCache = new LRUCache<unknown>({ maxSize: 200, defaultTTL: 3 * 60 * 1000, name: "jobs" });
export const queryCache = new LRUCache<unknown>({ maxSize: 2000, defaultTTL: 30 * 1000, name: "queries" });

const allCaches = [settingsCache, userCache, jobCache, queryCache];

setInterval(() => {
  for (const cache of allCaches) {
    cache.prune();
  }
}, 60000);

export function getAllCacheStats() {
  return allCaches.map(c => c.getStats());
}

export function invalidateAllCaches() {
  for (const cache of allCaches) {
    cache.clear();
  }
}
