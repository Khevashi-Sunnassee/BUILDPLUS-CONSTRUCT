import { Router, Request, Response } from "express";
import { pool } from "../db";
import logger from "../lib/logger";
import { getMetrics } from "./request-timing";

const router = Router();

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: { status: string; latencyMs?: number; error?: string };
    memory: { status: string; heapUsedMB: number; heapTotalMB: number; rssMB: number; percentUsed: number };
    eventLoop: { status: string };
  };
}

router.get("/health", async (_req: Request, res: Response) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      database: { status: "unknown" },
      memory: { status: "unknown", heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, percentUsed: 0 },
      eventLoop: { status: "healthy" },
    },
  };

  try {
    const dbStart = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;
    health.checks.database = {
      status: dbLatency > 1000 ? "degraded" : "healthy",
      latencyMs: dbLatency,
    };
    if (dbLatency > 1000) health.status = "degraded";
  } catch (err: any) {
    health.checks.database = { status: "unhealthy", error: err.message };
    health.status = "unhealthy";
    logger.error({ err }, "Health check: database connection failed");
  }

  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const percentUsed = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  health.checks.memory = {
    status: percentUsed > 90 ? "degraded" : "healthy",
    heapUsedMB,
    heapTotalMB,
    rssMB,
    percentUsed,
  };
  if (percentUsed > 90) health.status = "degraded";

  const statusCode = health.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(health);
});

router.get("/health/db", async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        pg_database_size(current_database()) as db_size_bytes,
        now() as server_time
    `);

    const row = result.rows[0];
    res.json({
      status: "healthy",
      activeConnections: parseInt(row.active_connections),
      idleConnections: parseInt(row.idle_connections),
      maxConnections: parseInt(row.max_connections),
      databaseSizeMB: Math.round(parseInt(row.db_size_bytes) / 1024 / 1024),
      serverTime: row.server_time,
      poolSize: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount,
    });
  } catch (err: any) {
    logger.error({ err }, "Database health check failed");
    res.status(503).json({ status: "unhealthy", error: err.message });
  }
});

router.get("/health/metrics", async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const requestMetrics = getMetrics();
  const mem = process.memoryUsage();

  res.json({
    application: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid,
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
    },
    requests: requestMetrics,
  });
});

export const healthRouter = router;
