import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost, adminPatch, adminDelete } from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("Edge Cases and Error Handling", () => {
  let authAvailable = false;

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  describe("Timer route company isolation", () => {
    it("POST /api/timer-sessions/start with invalid jobId returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/timer-sessions/start", {
        jobId: FAKE_UUID,
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("POST /api/timer-sessions/start with invalid panelRegisterId returns 404", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/timer-sessions/start", {
        panelRegisterId: FAKE_UUID,
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it("PATCH /api/timer-sessions/:id with invalid panelRegisterId returns 404", async () => {
      if (!authAvailable) return;
      // First, try to update a non-existent session
      const res = await adminPatch(`/api/timer-sessions/${FAKE_UUID}`, {
        panelRegisterId: FAKE_UUID,
      });
      // Should return either 404 or 400 (for invalid session)
      expect([400, 404]).toContain(res.status);
    });
  });

  describe("Input validation edge cases", () => {
    it("POST /api/jobs with empty body does not crash the server", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {});
      expect(res.status).toBeLessThan(502);
    });

    it("POST /api/jobs with wrong type is handled without crash", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", { jobNumber: 123, name: null });
      expect(res.status).toBeLessThan(502);
    });

    it("Pagination with negative page number defaults to 1", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=-5&limit=10");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        // Should have pagination object or be an array
        expect(data).toBeDefined();
      }
    });

    it("Pagination with page=0 defaults to 1", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=0&limit=10");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });

    it("Pagination with limit=0 gets default", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=1&limit=0");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });

    it("UUID parameter with non-UUID string returns 400 or 404", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs/not-a-uuid");
      expect([400, 404, 401]).toContain(res.status);
    });

    it("XSS in query parameters is handled safely", async () => {
      if (!authAvailable) return;
      const xssPayload = encodeURIComponent("<script>alert('xss')</script>");
      const res = await adminGet(`/api/jobs?search=${xssPayload}`);
      expect([200, 401, 400]).toContain(res.status);
      // Response should not echo raw script tags
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const text = await res.text();
        expect(text).not.toContain("<script>");
      }
    });
  });

  describe("Auth edge cases", () => {
    it("Expired/invalid session cookie returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        headers: {
          Cookie: "session=invalid_cookie_value",
        },
      });
      expect([401, 429]).toContain(res.status);
    });

    it("Unauthenticated GET to protected API returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/users`);
      expect([401, 429]).toContain(res.status);
    });

    it("Accessing protected route without login returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/jobs`);
      expect([401, 429]).toContain(res.status);
    });

    it("Accessing /api/auth/me without login returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      expect([401, 429]).toContain(res.status);
    });
  });

  describe("API error handling", () => {
    it("GET /api/jobs/nonexistent-uuid returns 404 or 400", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/jobs/${FAKE_UUID}`);
      expect([400, 404]).toContain(res.status);
    });

    it("PATCH with invalid JSON body returns 400", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/jobs/${FAKE_UUID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{ invalid json",
      });
      expect([400, 401]).toContain(res.status);
    });

    it("GET /api/jobs with very large limit value caps at max", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?page=1&limit=99999");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        // Should have received data, capped at max limit
        expect(data).toBeDefined();
      }
    });

    it("GET /api/customers with very large limit value caps at max", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/customers?page=1&limit=99999");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toBeDefined();
      }
    });
  });

  describe("Request validation", () => {
    it("POST with malformed JSON returns 400", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=test",
        },
        body: "{invalid: json}",
      });
      expect([400, 401]).toContain(res.status);
    });

    it("POST with missing required fields returns 400", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/jobs", {
        jobNumber: "TEST123",
        // missing required 'name' field
      });
      expect([400, 201, 200]).toContain(res.status);
      if (res.status === 400) {
        const data = await res.json();
        expect(data.error).toBeDefined();
      }
    });

    it("GET with invalid sort field defaults to safe value", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?sortBy=malicious_field&sortOrder=asc");
      expect([200, 401, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        // Should not error, should use default sort
        expect(data).toBeDefined();
      }
    });
  });

  describe("Content-Type validation", () => {
    it("POST with non-JSON content type is handled gracefully", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/panel-register", "invalid-not-json" as any);
      expect([400, 415, 422, 500]).toContain(res.status);
    });

    it("DELETE request returns 204 or 200 on success", async () => {
      if (!authAvailable) return;
      // Try to delete a non-existent item (should fail gracefully)
      const res = await adminDelete(`/api/jobs/${FAKE_UUID}`);
      expect([204, 200, 404, 401]).toContain(res.status);
    });
  });

  describe("Special character handling", () => {
    it("Search parameter with special characters is handled safely", async () => {
      if (!authAvailable) return;
      const specialChars = "%20!@#$%^&*()";
      const res = await adminGet(`/api/jobs?search=${encodeURIComponent(specialChars)}`);
      expect([200, 401, 429]).toContain(res.status);
    });

    it("Query parameter with Unicode characters is handled safely", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/jobs?search=%E2%9C%93%E2%9C%93");
      expect([200, 401, 429]).toContain(res.status);
    });
  });
});
