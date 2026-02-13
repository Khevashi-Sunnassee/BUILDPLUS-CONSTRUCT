import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

const SLOW_REQUEST_THRESHOLD_MS = 3000;
const VERY_SLOW_REQUEST_THRESHOLD_MS = 10000;

interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  slowRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  responseTimes: number[];
  endpointStats: Map<string, { count: number; totalTime: number; errors: number; maxTime: number }>;
  startedAt: Date;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  slowRequests: 0,
  avgResponseTime: 0,
  p95ResponseTime: 0,
  responseTimes: [],
  endpointStats: new Map(),
  startedAt: new Date(),
};

const MAX_RESPONSE_TIMES = 10000;

function getRouteKey(req: Request): string {
  const method = req.method;
  let path = req.route?.path || req.path;
  path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id");
  path = path.replace(/\/\d+/g, "/:id");
  return `${method} ${path}`;
}

function updatePercentile() {
  if (metrics.responseTimes.length === 0) return;
  const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  metrics.p95ResponseTime = sorted[p95Index] || 0;
  metrics.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  const originalEnd = res.end.bind(res);
  (res as any).end = function (...args: any[]) {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    const statusCode = res.statusCode;

    metrics.totalRequests++;
    if (statusCode >= 400) metrics.totalErrors++;

    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      metrics.slowRequests++;
      const level = duration > VERY_SLOW_REQUEST_THRESHOLD_MS ? "warn" : "info";
      logger[level]({
        method: req.method,
        path: req.path,
        statusCode,
        durationMs: Math.round(duration),
      }, `Slow request detected (${Math.round(duration)}ms)`);
    }

    metrics.responseTimes.push(duration);
    if (metrics.responseTimes.length > MAX_RESPONSE_TIMES) {
      metrics.responseTimes = metrics.responseTimes.slice(-MAX_RESPONSE_TIMES / 2);
    }

    const routeKey = getRouteKey(req);
    const existing = metrics.endpointStats.get(routeKey) || { count: 0, totalTime: 0, errors: 0, maxTime: 0 };
    existing.count++;
    existing.totalTime += duration;
    existing.maxTime = Math.max(existing.maxTime, duration);
    if (statusCode >= 400) existing.errors++;
    metrics.endpointStats.set(routeKey, existing);

    if (metrics.totalRequests % 100 === 0) {
      updatePercentile();
    }

    return originalEnd(...args);
  };

  next();
}

export function getMetrics() {
  updatePercentile();

  const topSlowest = [...metrics.endpointStats.entries()]
    .map(([route, stats]) => ({
      route,
      avgMs: Math.round(stats.totalTime / stats.count),
      maxMs: Math.round(stats.maxTime),
      count: stats.count,
      errors: stats.errors,
      errorRate: stats.count > 0 ? Math.round((stats.errors / stats.count) * 100) : 0,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 20);

  const topByVolume = [...metrics.endpointStats.entries()]
    .map(([route, stats]) => ({
      route,
      count: stats.count,
      avgMs: Math.round(stats.totalTime / stats.count),
      errors: stats.errors,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    uptime: Math.round((Date.now() - metrics.startedAt.getTime()) / 1000),
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    errorRate: metrics.totalRequests > 0 ? Math.round((metrics.totalErrors / metrics.totalRequests) * 100 * 100) / 100 : 0,
    slowRequests: metrics.slowRequests,
    avgResponseTimeMs: Math.round(metrics.avgResponseTime),
    p95ResponseTimeMs: Math.round(metrics.p95ResponseTime),
    topSlowestEndpoints: topSlowest,
    topByVolume,
  };
}

export function resetMetrics() {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.slowRequests = 0;
  metrics.avgResponseTime = 0;
  metrics.p95ResponseTime = 0;
  metrics.responseTimes = [];
  metrics.endpointStats.clear();
  metrics.startedAt = new Date();
}
