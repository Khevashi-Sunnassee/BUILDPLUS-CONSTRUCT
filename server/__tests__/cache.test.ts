import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache, getAllCacheStats, invalidateAllCaches } from '../lib/cache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;
  
  beforeEach(() => {
    cache = new LRUCache<string>({ maxSize: 3, defaultTTL: 5000, name: 'test' });
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should expire entries after TTL', () => {
    vi.useFakeTimers();
    cache.set('key1', 'value1', 100);
    expect(cache.get('key1')).toBe('value1');
    vi.advanceTimersByTime(150);
    expect(cache.get('key1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('should evict oldest entries when maxSize exceeded', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('d')).toBe('4');
  });

  it('should move accessed items to most recent', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.get('a');
    cache.set('d', '4');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  it('should invalidate specific keys', () => {
    cache.set('key1', 'value1');
    expect(cache.invalidate('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should invalidate by pattern', () => {
    cache.set('user:1', 'a');
    cache.set('user:2', 'b');
    cache.set('job:1', 'c');
    const count = cache.invalidatePattern('user:');
    expect(count).toBe(2);
    expect(cache.get('job:1')).toBe('c');
  });

  it('should track hits and misses', () => {
    cache.set('key1', 'value1');
    cache.get('key1');
    cache.get('key1');
    cache.get('missing');
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('66.7%');
  });

  it('should prune expired entries', () => {
    vi.useFakeTimers();
    cache.set('a', '1', 50);
    cache.set('b', '2', 200);
    vi.advanceTimersByTime(100);
    const pruned = cache.prune();
    expect(pruned).toBe(1);
    expect(cache.get('b')).toBe('2');
    vi.useRealTimers();
  });

  it('should clear all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    const stats = cache.getStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
  });
});

describe('Cache instances', () => {
  it('getAllCacheStats returns stats for all caches', () => {
    const stats = getAllCacheStats();
    expect(stats.length).toBeGreaterThanOrEqual(4);
    expect(stats[0]).toHaveProperty('name');
    expect(stats[0]).toHaveProperty('size');
    expect(stats[0]).toHaveProperty('hitRate');
  });

  it('invalidateAllCaches clears all caches', () => {
    invalidateAllCaches();
    const stats = getAllCacheStats();
    for (const s of stats) {
      expect(s.size).toBe(0);
    }
  });
});
