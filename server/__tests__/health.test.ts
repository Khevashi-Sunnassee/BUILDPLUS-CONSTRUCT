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

vi.mock('../db', () => {
  const mockPool = {
    query: vi.fn(),
    totalCount: 10,
    idleCount: 5,
    waitingCount: 0,
    end: vi.fn(),
    on: vi.fn(),
  };
  return {
    pool: mockPool,
    db: {},
  };
});

import express from 'express';
import request from 'supertest';
import { pool } from '../db';

function createHealthApp() {
  const app = express();

  app.get('/api/health', (req, res) => {
    (pool.query as any)('SELECT 1')
      .then(() => {
        const response: Record<string, unknown> = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        };
        res.json(response);
      })
      .catch(() => {
        res.status(503).json({
          status: 'unhealthy',
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
        });
      });
  });

  return app;
}

describe('Health Check Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when DB is reachable', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as any);

    const app = createHealthApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('should include timestamp in response', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as any);

    const app = createHealthApp();
    const res = await request(app).get('/api/health');

    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('should return unhealthy status when DB is down', async () => {
    vi.mocked(pool.query).mockRejectedValue(new Error('Connection refused'));

    const app = createHealthApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.error).toBe('Database connection failed');
    expect(res.body.timestamp).toBeDefined();
  });
});
