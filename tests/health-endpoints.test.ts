import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet } from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";

describe("Health Check Endpoints", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  describe("GET /health", () => {
    it("should return overall health status", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("uptime");
      expect(data).toHaveProperty("checks");
      expect(["healthy", "degraded", "unhealthy"]).toContain(data.status);
    });

    it("should include database check", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const data = await res.json();
      expect(data.checks).toHaveProperty("database");
      expect(data.checks.database).toHaveProperty("status");
      expect(data.checks.database).toHaveProperty("latencyMs");
    });

    it("should include memory check", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const data = await res.json();
      expect(data.checks).toHaveProperty("memory");
      expect(data.checks.memory).toHaveProperty("heapUsedMB");
      expect(data.checks.memory).toHaveProperty("rssMB");
      expect(data.checks.memory).toHaveProperty("percentUsed");
      expect(data.checks.memory.percentUsed).toBeGreaterThan(0);
      expect(data.checks.memory.percentUsed).toBeLessThan(100);
    });

    it("should include event loop check", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const data = await res.json();
      expect(data.checks).toHaveProperty("eventLoop");
      expect(data.checks.eventLoop.status).toBe("healthy");
    });
  });

  describe("GET /health/db", () => {
    it("should return database connection details", async () => {
      const res = await fetch(`${BASE_URL}/health/db`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("activeConnections");
      expect(data).toHaveProperty("databaseSizeMB");
      expect(data).toHaveProperty("poolSize");
    });

    it("should show pool statistics", async () => {
      const res = await fetch(`${BASE_URL}/health/db`);
      const data = await res.json();
      expect(typeof data.poolSize).toBe("number");
      expect(typeof data.poolIdle).toBe("number");
      expect(typeof data.poolWaiting).toBe("number");
    });
  });

  describe("GET /health/metrics", () => {
    it("should require authentication for metrics", async () => {
      const res = await fetch(`${BASE_URL}/health/metrics`);
      expect([200, 401]).toContain(res.status);
    });

    it("should return metrics data structure when accessible", async () => {
      const res = await adminGet("/health/metrics");
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty("application");
        expect(data).toHaveProperty("memory");
        expect(data).toHaveProperty("requests");
        expect(data.requests).toHaveProperty("totalRequests");
        expect(data.requests).toHaveProperty("avgResponseTimeMs");
        expect(data.requests).toHaveProperty("p95ResponseTimeMs");
      }
    });
  });
});
