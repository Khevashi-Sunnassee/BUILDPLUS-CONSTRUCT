import http from "http";

const BASE_URL = "http://localhost:5000";
const ADMIN_EMAIL = "admin@buildplus.ai";
const ADMIN_PASSWORD = "admin123";

interface LoadTestConfig {
  name: string;
  stages: { duration: number; targetUsers: number }[];
  endpoints: { method: string; path: string; weight: number }[];
}

interface StageResult {
  stage: number;
  targetUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  requestsPerSecond: number;
  errorRate: number;
  statusCodes: Record<number, number>;
}

async function authenticate(): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const req = http.request(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
    }, (res) => {
      const cookies = res.headers["set-cookie"] || [];
      const sessionCookie = cookies.map(c => c.split(";")[0]).join("; ");
      res.resume();
      res.on("end", () => {
        if (sessionCookie) resolve(sessionCookie);
        else reject(new Error("No session cookie returned"));
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

function makeRequest(path: string, cookie: string): Promise<{ status: number; latencyMs: number }> {
  const start = performance.now();
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}${path}`, {
      headers: { Cookie: cookie },
    }, (res) => {
      res.resume();
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, latencyMs: performance.now() - start });
      });
    });
    req.on("error", () => {
      resolve({ status: 0, latencyMs: performance.now() - start });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ status: 0, latencyMs: performance.now() - start });
    });
  });
}

function selectEndpoint(endpoints: { method: string; path: string; weight: number }[]): string {
  const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  for (const ep of endpoints) {
    random -= ep.weight;
    if (random <= 0) return ep.path;
  }
  return endpoints[0].path;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runStage(
  stageNum: number,
  targetUsers: number,
  durationSec: number,
  cookie: string,
  endpoints: { method: string; path: string; weight: number }[]
): Promise<StageResult> {
  const latencies: number[] = [];
  const statusCodes: Record<number, number> = {};
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;

  const rampUpInterval = durationSec > 5 ? 1000 : 500;
  let activeUsers = 0;
  let running = true;

  async function userLoop(userId: number) {
    while (running && Date.now() < endTime) {
      const path = selectEndpoint(endpoints);
      const result = await makeRequest(path, cookie);
      latencies.push(result.latencyMs);
      statusCodes[result.status] = (statusCodes[result.status] || 0) + 1;
      if (result.status >= 200 && result.status < 500) {
        successCount++;
      } else {
        failCount++;
      }
      const delay = Math.max(50, 500 + Math.random() * 1000 - (targetUsers > 100 ? 400 : 0));
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const userPromises: Promise<void>[] = [];
  const rampTimer = setInterval(() => {
    const usersToAdd = Math.min(
      Math.ceil(targetUsers / Math.max(1, (durationSec * 1000) / rampUpInterval)),
      targetUsers - activeUsers
    );
    for (let i = 0; i < usersToAdd && activeUsers < targetUsers; i++) {
      activeUsers++;
      userPromises.push(userLoop(activeUsers));
    }
    if (activeUsers >= targetUsers) clearInterval(rampTimer);
  }, rampUpInterval);

  await new Promise(r => setTimeout(r, durationSec * 1000));
  running = false;
  clearInterval(rampTimer);
  await Promise.allSettled(userPromises);

  const totalDuration = (Date.now() - startTime) / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);

  return {
    stage: stageNum,
    targetUsers,
    totalRequests: successCount + failCount,
    successfulRequests: successCount,
    failedRequests: failCount,
    avgLatencyMs: sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0,
    p95LatencyMs: Math.round(percentile(sorted, 95)),
    p99LatencyMs: Math.round(percentile(sorted, 99)),
    maxLatencyMs: Math.round(sorted[sorted.length - 1] || 0),
    minLatencyMs: Math.round(sorted[0] || 0),
    requestsPerSecond: Math.round((successCount + failCount) / totalDuration * 10) / 10,
    errorRate: Math.round(((failCount) / Math.max(1, successCount + failCount)) * 10000) / 100,
    statusCodes,
  };
}

async function runLoadTest(config: LoadTestConfig) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  LOAD TEST: ${config.name}`);
  console.log(`${"=".repeat(70)}\n`);

  console.log("Authenticating...");
  let cookie: string;
  try {
    cookie = await authenticate();
    console.log("Authentication successful\n");
  } catch (e) {
    console.error("Authentication failed:", e);
    process.exit(1);
  }

  const results: StageResult[] = [];

  for (let i = 0; i < config.stages.length; i++) {
    const stage = config.stages[i];
    console.log(`--- Stage ${i + 1}: ${stage.targetUsers} concurrent users for ${stage.duration}s ---`);
    const result = await runStage(i + 1, stage.targetUsers, stage.duration, cookie, config.endpoints);
    results.push(result);

    console.log(`  Requests:     ${result.totalRequests} (${result.successfulRequests} ok, ${result.failedRequests} failed)`);
    console.log(`  RPS:          ${result.requestsPerSecond}`);
    console.log(`  Latency:      avg=${result.avgLatencyMs}ms  p95=${result.p95LatencyMs}ms  p99=${result.p99LatencyMs}ms  max=${result.maxLatencyMs}ms`);
    console.log(`  Error Rate:   ${result.errorRate}%`);
    console.log(`  Status Codes: ${JSON.stringify(result.statusCodes)}`);
    console.log();
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("  SUMMARY");
  console.log(`${"=".repeat(70)}`);
  console.log();
  console.log("Stage | Users |  Reqs  |  RPS  | Avg(ms) | P95(ms) | P99(ms) | Errors");
  console.log("-".repeat(75));
  for (const r of results) {
    console.log(
      `  ${String(r.stage).padStart(2)}  | ${String(r.targetUsers).padStart(5)} | ${String(r.totalRequests).padStart(6)} | ${String(r.requestsPerSecond).padStart(5)} | ${String(r.avgLatencyMs).padStart(7)} | ${String(r.p95LatencyMs).padStart(7)} | ${String(r.p99LatencyMs).padStart(7)} | ${r.errorRate}%`
    );
  }

  const passThresholds = {
    maxP95LatencyMs: 2000,
    maxErrorRate: 5,
    minRps: 10,
  };

  console.log(`\n--- PASS/FAIL CRITERIA ---`);
  console.log(`  P95 Latency < ${passThresholds.maxP95LatencyMs}ms`);
  console.log(`  Error Rate  < ${passThresholds.maxErrorRate}%`);
  console.log(`  RPS         > ${passThresholds.minRps}`);

  const lastStage = results[results.length - 1];
  const passed = lastStage.p95LatencyMs < passThresholds.maxP95LatencyMs
    && lastStage.errorRate < passThresholds.maxErrorRate
    && lastStage.requestsPerSecond > passThresholds.minRps;

  console.log(`\n  RESULT: ${passed ? "PASS" : "FAIL"}`);

  const report = {
    testName: config.name,
    timestamp: new Date().toISOString(),
    stages: results,
    passed,
    thresholds: passThresholds,
  };
  const fs = await import("fs");
  fs.writeFileSync("tests/load-test-results.json", JSON.stringify(report, null, 2));
  console.log("\n  Results saved to tests/load-test-results.json\n");

  if (!passed) process.exit(1);
}

const config: LoadTestConfig = {
  name: "BuildPlus AI - 300+ User Scalability Test",
  stages: [
    { duration: 10, targetUsers: 50 },
    { duration: 15, targetUsers: 150 },
    { duration: 20, targetUsers: 300 },
    { duration: 10, targetUsers: 350 },
  ],
  endpoints: [
    { method: "GET", path: "/api/dashboard/stats", weight: 15 },
    { method: "GET", path: "/api/auth/me", weight: 10 },
    { method: "GET", path: "/api/jobs", weight: 10 },
    { method: "GET", path: "/api/jobs/opportunities", weight: 8 },
    { method: "GET", path: "/api/daily-logs", weight: 10 },
    { method: "GET", path: "/api/chat/conversations", weight: 12 },
    { method: "GET", path: "/api/chat/total-unread", weight: 8 },
    { method: "GET", path: "/api/user/settings", weight: 5 },
    { method: "GET", path: "/api/my-permissions", weight: 5 },
    { method: "GET", path: "/api/admin/factories", weight: 3 },
    { method: "GET", path: "/api/task-notifications", weight: 5 },
    { method: "GET", path: "/api/load-lists", weight: 4 },
    { method: "GET", path: "/api/ap-invoices", weight: 3 },
    { method: "GET", path: "/api/tenders", weight: 2 },
  ],
};

runLoadTest(config);
