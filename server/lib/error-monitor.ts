import logger from "./logger";

interface ErrorRecord {
  message: string;
  stack?: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  route?: string;
  method?: string;
  statusCode?: number;
}

const MAX_TRACKED_ERRORS = 500;
const WINDOW_MS = 60 * 60 * 1000;

class ErrorMonitor {
  private errors: Map<string, ErrorRecord> = new Map();
  private errorCounts = { total: 0, last5min: 0 };
  private recentTimestamps: number[] = [];

  private getFingerprint(err: Error, route?: string, method?: string): string {
    const msg = err.message?.slice(0, 100) || "unknown";
    return `${method || ""}:${route || ""}:${msg}`;
  }

  track(err: Error, meta?: { route?: string; method?: string; statusCode?: number }) {
    const fingerprint = this.getFingerprint(err, meta?.route, meta?.method);
    const now = new Date();
    const nowMs = now.getTime();

    this.errorCounts.total++;
    this.recentTimestamps.push(nowMs);
    const fiveMinAgo = nowMs - 5 * 60 * 1000;
    this.recentTimestamps = this.recentTimestamps.filter(t => t > fiveMinAgo);
    this.errorCounts.last5min = this.recentTimestamps.length;

    const existing = this.errors.get(fingerprint);
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
    } else {
      if (this.errors.size >= MAX_TRACKED_ERRORS) {
        const oldest = [...this.errors.entries()]
          .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime())[0];
        if (oldest) this.errors.delete(oldest[0]);
      }
      this.errors.set(fingerprint, {
        message: err.message,
        stack: err.stack?.split("\n").slice(0, 5).join("\n"),
        count: 1,
        firstSeen: now,
        lastSeen: now,
        route: meta?.route,
        method: meta?.method,
        statusCode: meta?.statusCode,
      });
    }

    if (this.errorCounts.last5min > 50) {
      logger.warn(
        { errorsLast5min: this.errorCounts.last5min },
        "High error rate detected"
      );
    }
  }

  getSummary() {
    const cutoff = Date.now() - WINDOW_MS;
    const recentErrors = [...this.errors.values()]
      .filter(e => e.lastSeen.getTime() > cutoff)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalErrors: this.errorCounts.total,
      errorsLast5min: this.errorCounts.last5min,
      uniqueErrors: this.errors.size,
      topErrors: recentErrors.map(e => ({
        message: e.message,
        count: e.count,
        route: e.route,
        method: e.method,
        statusCode: e.statusCode,
        lastSeen: e.lastSeen.toISOString(),
      })),
    };
  }
}

export { ErrorMonitor };
export const errorMonitor = new ErrorMonitor();
