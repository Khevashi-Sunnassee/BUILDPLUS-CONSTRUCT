import { pool } from "../db";
import { getEventLoopLag } from "./metrics";
import { getAllCircuitStats } from "./circuit-breaker";
import { getAllCacheStats } from "./cache";
import { getAllQueueStats } from "./job-queue";
import { getMetrics } from "../middleware/request-timing";
import { errorMonitor } from "./error-monitor";
import logger from "./logger";

let sessionCount = 0;
let sessionQueryLastUpdated = 0;
const SESSION_QUERY_INTERVAL = 60000;

async function getSessionCount(): Promise<number> {
  const now = Date.now();
  if (now - sessionQueryLastUpdated < SESSION_QUERY_INTERVAL) {
    return sessionCount;
  }
  try {
    const result = await pool.query(
      `SELECT count(*) as total FROM "session" WHERE expire > NOW()`
    );
    sessionCount = parseInt(result.rows[0]?.total || "0", 10);
    sessionQueryLastUpdated = now;
  } catch (err) {
    logger.debug("Failed to query session count for metrics");
  }
  return sessionCount;
}

function line(name: string, value: number, labels?: Record<string, string>): string {
  if (labels && Object.keys(labels).length > 0) {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
      .join(",");
    return `${name}{${labelStr}} ${value}`;
  }
  return `${name} ${value}`;
}

function header(name: string, help: string, type: string): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}`;
}

export async function generatePrometheusMetrics(): Promise<string> {
  const lines: string[] = [];

  const mem = process.memoryUsage();
  lines.push(header("nodejs_heap_used_bytes", "Node.js heap used in bytes", "gauge"));
  lines.push(line("nodejs_heap_used_bytes", mem.heapUsed));
  lines.push(header("nodejs_heap_total_bytes", "Node.js heap total in bytes", "gauge"));
  lines.push(line("nodejs_heap_total_bytes", mem.heapTotal));
  lines.push(header("nodejs_rss_bytes", "Node.js RSS in bytes", "gauge"));
  lines.push(line("nodejs_rss_bytes", mem.rss));
  lines.push(header("nodejs_external_bytes", "Node.js external memory in bytes", "gauge"));
  lines.push(line("nodejs_external_bytes", mem.external));

  lines.push(header("nodejs_eventloop_lag_seconds", "Event loop lag in seconds", "gauge"));
  lines.push(line("nodejs_eventloop_lag_seconds", getEventLoopLag() / 1000));

  lines.push(header("process_uptime_seconds", "Process uptime in seconds", "gauge"));
  lines.push(line("process_uptime_seconds", Math.round(process.uptime())));

  const reqMetrics = getMetrics();
  lines.push(header("http_requests_total", "Total HTTP requests", "counter"));
  lines.push(line("http_requests_total", reqMetrics.totalRequests));
  lines.push(header("http_errors_total", "Total HTTP errors (4xx+5xx)", "counter"));
  lines.push(line("http_errors_total", reqMetrics.totalErrors));
  lines.push(header("http_slow_requests_total", "Total slow requests (>3s)", "counter"));
  lines.push(line("http_slow_requests_total", reqMetrics.slowRequests));
  lines.push(header("http_request_duration_avg_ms", "Average response time in ms", "gauge"));
  lines.push(line("http_request_duration_avg_ms", reqMetrics.avgResponseTimeMs));
  lines.push(header("http_request_duration_p95_ms", "p95 response time in ms", "gauge"));
  lines.push(line("http_request_duration_p95_ms", reqMetrics.p95ResponseTimeMs));
  lines.push(header("http_error_rate_percent", "HTTP error rate percentage", "gauge"));
  lines.push(line("http_error_rate_percent", reqMetrics.errorRate));

  if (reqMetrics.topSlowestEndpoints) {
    lines.push(header("http_endpoint_duration_avg_ms", "Average endpoint response time in ms", "gauge"));
    lines.push(header("http_endpoint_duration_max_ms", "Max endpoint response time in ms", "gauge"));
    lines.push(header("http_endpoint_requests_total", "Total requests per endpoint", "counter"));
    lines.push(header("http_endpoint_errors_total", "Total errors per endpoint", "counter"));
    for (const ep of reqMetrics.topSlowestEndpoints.slice(0, 20)) {
      const labels = { route: ep.route };
      lines.push(line("http_endpoint_duration_avg_ms", ep.avgMs, labels));
      lines.push(line("http_endpoint_duration_max_ms", ep.maxMs, labels));
      lines.push(line("http_endpoint_requests_total", ep.count, labels));
      lines.push(line("http_endpoint_errors_total", ep.errors, labels));
    }
  }

  lines.push(header("db_pool_total_connections", "Total DB pool connections", "gauge"));
  lines.push(line("db_pool_total_connections", pool.totalCount));
  lines.push(header("db_pool_idle_connections", "Idle DB pool connections", "gauge"));
  lines.push(line("db_pool_idle_connections", pool.idleCount));
  lines.push(header("db_pool_waiting_count", "Waiting DB pool requests", "gauge"));
  lines.push(line("db_pool_waiting_count", pool.waitingCount));
  lines.push(header("db_pool_max_connections", "Max DB pool connections", "gauge"));
  lines.push(line("db_pool_max_connections", 100));
  lines.push(header("db_pool_utilization_percent", "DB pool utilization", "gauge"));
  const utilization = pool.totalCount > 0
    ? ((pool.totalCount - pool.idleCount) / pool.totalCount) * 100
    : 0;
  lines.push(line("db_pool_utilization_percent", Math.round(utilization * 100) / 100));

  const circuitStats = getAllCircuitStats();
  lines.push(header("circuit_breaker_state", "Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)", "gauge"));
  lines.push(header("circuit_breaker_failures", "Circuit breaker current failures", "gauge"));
  lines.push(header("circuit_breaker_total_requests", "Circuit breaker total requests", "counter"));
  lines.push(header("circuit_breaker_total_failures", "Circuit breaker total failures", "counter"));
  for (const cb of circuitStats) {
    const labels = { name: cb.name };
    const stateVal = cb.state === "CLOSED" ? 0 : cb.state === "HALF_OPEN" ? 1 : 2;
    lines.push(line("circuit_breaker_state", stateVal, labels));
    lines.push(line("circuit_breaker_failures", cb.failures, labels));
    lines.push(line("circuit_breaker_total_requests", cb.totalRequests, labels));
    lines.push(line("circuit_breaker_total_failures", cb.totalFailures, labels));
  }

  const cacheStats = getAllCacheStats();
  lines.push(header("cache_size", "Current cache size", "gauge"));
  lines.push(header("cache_max_size", "Maximum cache size", "gauge"));
  lines.push(header("cache_hits_total", "Total cache hits", "counter"));
  lines.push(header("cache_misses_total", "Total cache misses", "counter"));
  for (const cache of cacheStats) {
    const labels = { name: cache.name };
    lines.push(line("cache_size", cache.size, labels));
    lines.push(line("cache_max_size", cache.maxSize, labels));
    lines.push(line("cache_hits_total", cache.hits, labels));
    lines.push(line("cache_misses_total", cache.misses, labels));
  }

  const queueStats = getAllQueueStats();
  lines.push(header("job_queue_size", "Current job queue size", "gauge"));
  lines.push(header("job_queue_running", "Currently running jobs", "gauge"));
  lines.push(header("job_queue_processed_total", "Total processed jobs", "counter"));
  lines.push(header("job_queue_failed_total", "Total failed jobs", "counter"));
  for (const q of queueStats) {
    const labels = { queue: q.name };
    lines.push(line("job_queue_size", q.queueSize, labels));
    lines.push(line("job_queue_running", q.running, labels));
    lines.push(line("job_queue_processed_total", q.processed, labels));
    lines.push(line("job_queue_failed_total", q.failed, labels));
  }

  const errorSummary = errorMonitor.getSummary();
  lines.push(header("error_monitor_total", "Total tracked errors", "counter"));
  lines.push(line("error_monitor_total", errorSummary.totalErrors));
  lines.push(header("error_monitor_last_5min", "Errors in last 5 minutes", "gauge"));
  lines.push(line("error_monitor_last_5min", errorSummary.errorsLast5min));
  lines.push(header("error_monitor_unique", "Unique error fingerprints", "gauge"));
  lines.push(line("error_monitor_unique", errorSummary.uniqueErrors));

  const activeSessionCount = await getSessionCount();
  lines.push(header("active_sessions", "Active sessions (not expired)", "gauge"));
  lines.push(line("active_sessions", activeSessionCount));

  return lines.join("\n") + "\n";
}
