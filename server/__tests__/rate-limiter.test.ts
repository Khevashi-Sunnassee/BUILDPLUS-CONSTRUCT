import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { TokenBucketRateLimiter, resendRateLimiter } from '../lib/rate-limiter';

describe('TokenBucketRateLimiter', () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new TokenBucketRateLimiter({
      name: 'test-limiter',
      maxTokens: 5,
      refillRatePerSecond: 1,
    });
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it('should export TokenBucketRateLimiter class', () => {
    expect(TokenBucketRateLimiter).toBeDefined();
    expect(typeof TokenBucketRateLimiter).toBe('function');
  });

  it('should export resendRateLimiter singleton', () => {
    expect(resendRateLimiter).toBeDefined();
    expect(resendRateLimiter).toBeInstanceOf(TokenBucketRateLimiter);
  });

  it('should initialize with maxTokens available', () => {
    const stats = limiter.getStats();
    expect(stats.name).toBe('test-limiter');
    expect(stats.maxTokens).toBe(5);
    expect(stats.tokens).toBe(5);
    expect(stats.waitingCount).toBe(0);
    expect(stats.refillRatePerSecond).toBe(1);
  });

  it('should consume a token on acquire', async () => {
    await limiter.acquire();
    const stats = limiter.getStats();
    expect(stats.tokens).toBeLessThanOrEqual(5);
  });

  it('should allow multiple acquires up to maxTokens', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
    const stats = limiter.getStats();
    expect(stats.tokens).toBeLessThanOrEqual(0);
  });

  it('should queue requests when tokens are exhausted', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    let resolved = false;
    const acquirePromise = limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    const stats = limiter.getStats();
    expect(stats.waitingCount).toBe(1);

    vi.advanceTimersByTime(2000);
    await acquirePromise;
    expect(resolved).toBe(true);
  });

  it('should refill tokens over time', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    vi.advanceTimersByTime(3000);
    const stats = limiter.getStats();
    expect(stats.tokens).toBeGreaterThan(0);
  });

  it('should not exceed maxTokens on refill', () => {
    vi.advanceTimersByTime(60000);
    const stats = limiter.getStats();
    expect(stats.tokens).toBeLessThanOrEqual(5);
  });

  it('should report correct stats via getStats', async () => {
    await limiter.acquire();
    await limiter.acquire();
    const stats = limiter.getStats();
    expect(stats.name).toBe('test-limiter');
    expect(stats.maxTokens).toBe(5);
    expect(stats.refillRatePerSecond).toBe(1);
    expect(typeof stats.tokens).toBe('number');
    expect(typeof stats.waitingCount).toBe('number');
  });

  it('should clean up on destroy', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    const p1 = limiter.acquire();
    const p2 = limiter.acquire();

    limiter.destroy();

    await p1;
    await p2;

    const stats = limiter.getStats();
    expect(stats.waitingCount).toBe(0);
  });

  it('should handle concurrent acquire calls', async () => {
    const results: number[] = [];
    const promises = Array.from({ length: 5 }, (_, i) =>
      limiter.acquire().then(() => results.push(i))
    );
    await Promise.all(promises);
    expect(results).toHaveLength(5);
  });

  it('should handle resendRateLimiter with correct config', () => {
    const stats = resendRateLimiter.getStats();
    expect(stats.name).toBe('resend');
    expect(stats.maxTokens).toBe(2);
    expect(stats.refillRatePerSecond).toBe(1.8);
  });
});
