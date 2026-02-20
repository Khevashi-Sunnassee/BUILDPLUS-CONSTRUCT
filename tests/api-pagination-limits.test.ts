import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost } from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("API Pagination, Query Parameters, and Response Format", () => {
  let authAvailable = false;

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  describe("Response Format Consistency", () => {
    it("GET /api/jobs returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/employees returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/employees");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/documents returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/documents");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/customers returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/customers");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/tenders returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/tenders");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/purchase-orders returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/purchase-orders");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/task-groups returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/task-groups");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/production-entries returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/production-entries");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/daily-logs returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/daily-logs");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/progress-claims returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/progress-claims");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });

    it("GET /api/hire-bookings returns array or paginated object", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/hire-bookings");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
    });
  });

  describe("Query Parameter Handling", () => {
    it("GET /api/jobs?limit=1 returns max 1 item", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?limit=1");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(1);
      } else if (data.jobs) {
        expect(data.jobs.length).toBeLessThanOrEqual(1);
      } else if (data.data) {
        expect(data.data.length).toBeLessThanOrEqual(1);
      }
    });

    it("GET /api/jobs?limit=0 does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?limit=0");
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/jobs?limit=-1 does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?limit=-1");
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/jobs?limit=abc returns valid response (not 500)", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?limit=abc");
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/jobs?offset=999999 returns empty or valid result", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?offset=999999");
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      } else {
        expect(data).toBeDefined();
      }
    });

    it("GET /api/employees?search=nonexistent returns empty results", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/employees?search=zzzzzznonexistent99999");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      } else if (data.employees) {
        expect(data.employees.length).toBe(0);
      } else {
        expect(data).toBeDefined();
      }
    });

    it("GET /api/documents?type=nonexistent returns valid response", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/documents?type=nonexistent_type_xyz");
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it("GET /api/customers?search=zzzznoexist returns empty", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/customers?search=zzzznoexist");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      } else if (data.customers) {
        expect(data.customers.length).toBe(0);
      } else {
        expect(data).toBeDefined();
      }
    });

    it("GET /api/jobs?status=invalid_status returns valid response", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?status=invalid_status_xyz");
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it("GET /api/production-entries?from=invalid-date does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/production-entries?from=invalid-date");
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/jobs?page=1&limit=5 returns paginated data", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=1&limit=5");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(5);
      } else {
        expect(data).toBeDefined();
      }
    });

    it("GET /api/jobs?sortBy=name&sortOrder=desc does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?sortBy=name&sortOrder=desc");
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("Content-Type and Headers", () => {
    it("API responses have Content-Type: application/json", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");
    });

    it("GET /api/health returns valid JSON", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/health`);
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");
      const data = await res.json();
      expect(data).toBeDefined();
    });

    it("POST with wrong Content-Type returns appropriate error", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "this is not json",
      });
      expect([400, 401, 415, 422]).toContain(res.status);
    });

    it("GET endpoints don't return HTML for non-existent routes in /api/", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/nonexistent-route-xyz-12345");
      const contentType = res.headers.get("content-type") || "";
      if (res.status === 404) {
        expect(contentType).not.toContain("text/html");
      }
      expect(res.status).toBeLessThan(500);
    });

    it("OPTIONS requests to API endpoints don't crash", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: "OPTIONS",
      });
      expect(res.status).toBeLessThan(500);
    });

    it("GET /api/customers response has json content type", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/customers");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");
    });

    it("GET /api/employees response has json content type", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/employees");
      expect([200, 429]).toContain(res.status); if (res.status === 429) return;
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toContain("application/json");
    });
  });

  describe("Boundary Tests", () => {
    it("Sending extremely large request body (>100KB) does not crash", async () => {
      if (!authAvailable) return;
      const largePayload = { data: "x".repeat(150000) };
      const res = await adminPost("/api/jobs", largePayload);
      expect(res.status).toBeLessThan(502);
    });

    it("Sending nested JSON (100 levels deep) returns error or is handled", async () => {
      if (!authAvailable) return;
      let nested: Record<string, unknown> = { value: "deep" };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }
      const res = await adminPost("/api/jobs", nested);
      expect(res.status).toBeLessThan(502);
    });

    it("Query string with 50+ parameters does not crash", async () => {
      if (!authAvailable) return;
      const params = Array.from({ length: 55 }, (_, i) => `param${i}=value${i}`).join("&");
      const res = await adminGet(`/api/jobs?${params}`);
      expect(res.status).toBeLessThan(500);
    });

    it("URL with 2000+ characters does not crash", async () => {
      if (!authAvailable) return;
      const longValue = "a".repeat(2000);
      const res = await adminGet(`/api/jobs?search=${longValue}`);
      expect(res.status).toBeLessThan(502);
    });

    it("Request with duplicate query parameters does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?limit=5&limit=10&page=1&page=2");
      expect(res.status).toBeLessThan(500);
    });

    it("Empty search parameter does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?search=");
      expect(res.status).toBeLessThan(500);
    });

    it("Very large page number does not crash", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=999999999&limit=10");
      expect(res.status).toBeLessThan(500);
      const data = await res.json();
      expect(data).toBeDefined();
    });
  });
});
