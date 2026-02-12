import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { ErrorMonitor } from '../lib/error-monitor';

describe('ErrorMonitor', () => {
  let monitor: InstanceType<typeof ErrorMonitor>;

  beforeEach(() => {
    monitor = new ErrorMonitor();
  });

  describe('track', () => {
    it('should track a new error', () => {
      const err = new Error('Test error');
      monitor.track(err, { route: '/api/test', method: 'GET', statusCode: 500 });

      const summary = monitor.getSummary();
      expect(summary.totalErrors).toBe(1);
      expect(summary.uniqueErrors).toBe(1);
      expect(summary.topErrors).toHaveLength(1);
      expect(summary.topErrors[0].message).toBe('Test error');
    });

    it('should increment count for same error fingerprint', () => {
      const err1 = new Error('Same error');
      const err2 = new Error('Same error');

      monitor.track(err1, { route: '/api/test', method: 'GET' });
      monitor.track(err2, { route: '/api/test', method: 'GET' });

      const summary = monitor.getSummary();
      expect(summary.totalErrors).toBe(2);
      expect(summary.uniqueErrors).toBe(1);
      expect(summary.topErrors[0].count).toBe(2);
    });

    it('should track different errors separately', () => {
      monitor.track(new Error('Error A'), { route: '/api/a', method: 'GET' });
      monitor.track(new Error('Error B'), { route: '/api/b', method: 'POST' });

      const summary = monitor.getSummary();
      expect(summary.totalErrors).toBe(2);
      expect(summary.uniqueErrors).toBe(2);
      expect(summary.topErrors).toHaveLength(2);
    });

    it('should update error counts for last5min', () => {
      monitor.track(new Error('Error 1'));
      monitor.track(new Error('Error 2'));
      monitor.track(new Error('Error 3'));

      const summary = monitor.getSummary();
      expect(summary.errorsLast5min).toBe(3);
      expect(summary.totalErrors).toBe(3);
    });
  });

  describe('MAX_TRACKED_ERRORS cap', () => {
    it('should evict oldest error when reaching 500 cap', () => {
      for (let i = 0; i < 501; i++) {
        monitor.track(new Error(`Error ${i}`), { route: `/api/route${i}`, method: 'GET' });
      }

      const summary = monitor.getSummary();
      expect(summary.uniqueErrors).toBeLessThanOrEqual(500);
    });
  });

  describe('getSummary', () => {
    it('should return correct format', () => {
      monitor.track(new Error('Test'), { route: '/api/test', method: 'GET', statusCode: 500 });

      const summary = monitor.getSummary();
      expect(summary).toHaveProperty('totalErrors');
      expect(summary).toHaveProperty('errorsLast5min');
      expect(summary).toHaveProperty('uniqueErrors');
      expect(summary).toHaveProperty('topErrors');
      expect(Array.isArray(summary.topErrors)).toBe(true);

      const topError = summary.topErrors[0];
      expect(topError).toHaveProperty('message');
      expect(topError).toHaveProperty('count');
      expect(topError).toHaveProperty('route');
      expect(topError).toHaveProperty('method');
      expect(topError).toHaveProperty('statusCode');
      expect(topError).toHaveProperty('lastSeen');
    });

    it('should limit topErrors to 20 entries', () => {
      for (let i = 0; i < 30; i++) {
        monitor.track(new Error(`Error ${i}`), { route: `/route${i}`, method: 'GET' });
      }

      const summary = monitor.getSummary();
      expect(summary.topErrors.length).toBeLessThanOrEqual(20);
    });

    it('should sort topErrors by count descending', () => {
      for (let i = 0; i < 5; i++) {
        monitor.track(new Error('Frequent error'), { route: '/api/freq', method: 'GET' });
      }
      monitor.track(new Error('Rare error'), { route: '/api/rare', method: 'GET' });

      const summary = monitor.getSummary();
      expect(summary.topErrors[0].message).toBe('Frequent error');
      expect(summary.topErrors[0].count).toBe(5);
    });
  });

  describe('high error rate warning', () => {
    it('should trigger warning when last5min exceeds 50', async () => {
      const logger = (await import('../lib/logger')).default;

      for (let i = 0; i < 51; i++) {
        monitor.track(new Error(`Error ${i}`), { route: `/api/route${i}`, method: 'GET' });
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ errorsLast5min: expect.any(Number) }),
        'High error rate detected'
      );
    });
  });
});
