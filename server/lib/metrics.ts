import logger from "./logger";

interface RouteMetrics {
  count: number;
  totalDuration: number;
  maxDuration: number;
  errors: number;
  lastCalled: Date;
}

class RequestMetrics {
  private routes: Map<string, RouteMetrics> = new Map();
  private startTime = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;

  record(method: string, path: string, duration: number, statusCode: number): void {
    this.totalRequests++;
    const key = `${method} ${this.normalizePath(path)}`;
    
    const existing = this.routes.get(key) || {
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
      errors: 0,
      lastCalled: new Date(),
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.lastCalled = new Date();

    if (statusCode >= 400) {
      existing.errors++;
      this.totalErrors++;
    }

    this.routes.set(key, existing);
  }

  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  getSummary() {
    const uptimeMs = Date.now() - this.startTime;
    const sortedRoutes = [...this.routes.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([route, metrics]) => ({
        route,
        count: metrics.count,
        avgDuration: Math.round(metrics.totalDuration / metrics.count),
        maxDuration: metrics.maxDuration,
        errors: metrics.errors,
        errorRate: metrics.count > 0 ? ((metrics.errors / metrics.count) * 100).toFixed(1) + "%" : "0%",
      }));

    const slowRoutes = [...this.routes.entries()]
      .filter(([, m]) => m.count > 0)
      .sort((a, b) => (b[1].totalDuration / b[1].count) - (a[1].totalDuration / a[1].count))
      .slice(0, 10)
      .map(([route, metrics]) => ({
        route,
        avgDuration: Math.round(metrics.totalDuration / metrics.count),
        maxDuration: metrics.maxDuration,
        count: metrics.count,
      }));

    return {
      uptime: Math.round(uptimeMs / 1000),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? ((this.totalErrors / this.totalRequests) * 100).toFixed(2) + "%" : "0%",
      requestsPerSecond: this.totalRequests > 0 ? (this.totalRequests / (uptimeMs / 1000)).toFixed(2) : "0",
      topRoutes: sortedRoutes,
      slowRoutes,
    };
  }

  reset(): void {
    this.routes.clear();
    this.totalRequests = 0;
    this.totalErrors = 0;
  }
}

export const requestMetrics = new RequestMetrics();

let eventLoopLag = 0;

function measureEventLoopLag() {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1e6;
    eventLoopLag = lag;
  });
}

setInterval(measureEventLoopLag, 5000);

export function getEventLoopLag(): number {
  return Math.round(eventLoopLag * 100) / 100;
}
