import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../lib/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  it('should execute successful calls in CLOSED state', async () => {
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
  });

  it('should track stats correctly', async () => {
    await breaker.execute(async () => 'ok');
    const stats = breaker.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.totalRequests).toBe(1);
    expect(stats.successes).toBe(1);
  });

  it('should open after reaching failure threshold', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    const stats = breaker.getStats();
    expect(stats.state).toBe('OPEN');
  });

  it('should reject requests when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    await expect(breaker.execute(async () => 'ok')).rejects.toThrow('Circuit breaker test is OPEN');
  });

  it('should use fallback when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    const result = await breaker.execute(async () => 'ok', () => 'fallback');
    expect(result).toBe('fallback');
  });

  it('should transition to HALF_OPEN after reset timeout', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    expect(breaker.getStats().state).toBe('OPEN');
    vi.advanceTimersByTime(1100);
    await breaker.execute(async () => 'recovered');
    expect(breaker.getStats().state).toBe('CLOSED');
    vi.useRealTimers();
  });

  it('should return to OPEN from HALF_OPEN on failure', async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    vi.advanceTimersByTime(1100);
    try {
      await breaker.execute(async () => { throw new Error('still failing'); });
    } catch {}
    expect(breaker.getStats().state).toBe('OPEN');
    vi.useRealTimers();
  });

  it('should use fallback on failure', async () => {
    const result = await breaker.execute(
      async () => { throw new Error('fail'); },
      () => 'fallback-value'
    );
    expect(result).toBe('fallback-value');
  });

  it('should reset properly', async () => {
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {}
    }
    breaker.reset();
    expect(breaker.getStats().state).toBe('CLOSED');
    expect(breaker.getStats().failures).toBe(0);
  });
});
