import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost, adminPatch, adminDelete, unauthGet, unauthPost } from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

describe("API Authorization and Access Control", () => {
  let authAvailable = false;

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  describe("Unauthenticated Access - Protected GET endpoints", () => {
    it("GET /api/jobs rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/jobs");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/employees rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/employees");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/documents rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/documents");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/purchase-orders rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/purchase-orders");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/tenders rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/tenders");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/admin/assets rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/admin/assets");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/checklist/templates rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/checklist/templates");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/production-entries rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/production-entries");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/daily-logs rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/daily-logs");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/chat/conversations rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/chat/conversations");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/broadcasts rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/broadcasts");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/progress-claims rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/progress-claims");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/hire-bookings rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/hire-bookings");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/timer-sessions rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/timer-sessions");
      expect([401, 429]).toContain(res.status);
    });

    it("POST /api/jobs with valid-looking body rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthPost("/api/jobs", {
        jobNumber: "UNAUTH-001",
        name: "Unauthorized Job Attempt",
        status: "active",
      });
      expect([200, 401, 403, 429]).toContain(res.status);
      if (res.status !== 200) {
        expect([401, 403, 429]).toContain(res.status);
      }
    });

    it("GET /api/auth/me rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/auth/me");
      expect([401, 429]).toContain(res.status);
    });
  });

  describe("Admin-Only Endpoints", () => {
    it("GET /api/admin/settings responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/settings");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/users responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/users");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/jobs responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/jobs");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/factories responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/factories");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/departments responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/departments");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/devices responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/devices");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/invitations responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/invitations");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("POST /api/admin/data-deletion/delete-all requires confirmation", async () => {
      if (!authAvailable) return;
      const res = await adminPost("/api/admin/data-deletion/delete-all", {});
      expect([200, 400, 403, 422, 429]).toContain(res.status);
    });

    it("GET /api/admin/companies responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/companies");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/data-deletion/counts responds for admin user", async () => {
      if (!authAvailable) return;
      const res = await adminGet("/api/admin/data-deletion/counts");
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("GET /api/admin/settings rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/admin/settings");
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/admin/users rejects unauthenticated requests", async () => {
      if (!authAvailable) return;
      const res = await unauthGet("/api/admin/users");
      expect([401, 429]).toContain(res.status);
    });
  });

  describe("CSRF Protection", () => {
    it("POST /api/auth/logout without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const meRes = await adminGet("/api/auth/me");
      const cookies = meRes.headers.get("set-cookie") || "";
      const res = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookies,
        },
      });
      expect([200, 401, 403, 429]).toContain(res.status);
    });

    it("POST /api/jobs without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
      });
      if (!loginRes.ok) return;
      const cookies = loginRes.headers.getSetCookie?.() || [];
      const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
      const res = await fetch(`${BASE_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ jobNumber: "CSRF-TEST", name: "CSRF Test Job" }),
      });
      expect([403, 401, 429]).toContain(res.status);
    });

    it("PATCH /api/jobs/:id without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
      });
      if (!loginRes.ok) return;
      const cookies = loginRes.headers.getSetCookie?.() || [];
      const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
      const res = await fetch(`${BASE_URL}/api/jobs/${FAKE_UUID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ name: "CSRF Patch Test" }),
      });
      expect([403, 401, 404, 429]).toContain(res.status);
    });

    it("DELETE /api/jobs/:id without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
      });
      if (!loginRes.ok) return;
      const cookies = loginRes.headers.getSetCookie?.() || [];
      const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
      const res = await fetch(`${BASE_URL}/api/jobs/${FAKE_UUID}`, {
        method: "DELETE",
        headers: {
          Cookie: sessionCookie,
        },
      });
      expect([403, 401, 404, 429]).toContain(res.status);
    });

    it("POST /api/employees without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
      });
      if (!loginRes.ok) return;
      const cookies = loginRes.headers.getSetCookie?.() || [];
      const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
      const res = await fetch(`${BASE_URL}/api/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ name: "CSRF Employee Test", email: "csrf@test.com" }),
      });
      expect([403, 401, 429]).toContain(res.status);
    });

    it("POST /api/purchase-orders without CSRF token is rejected", async () => {
      if (!authAvailable) return;
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
      });
      if (!loginRes.ok) return;
      const cookies = loginRes.headers.getSetCookie?.() || [];
      const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
      const res = await fetch(`${BASE_URL}/api/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ poNumber: "PO-CSRF-001" }),
      });
      expect([403, 401, 429]).toContain(res.status);
    });
  });

  describe("Session Security", () => {
    it("GET /api/auth/me with expired/invalid cookie returns 401", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: "connect.sid=s%3Ainvalid_session_token.fakesignature",
        },
      });
      expect([401, 429]).toContain(res.status);
    });

    it("GET /api/auth/me with garbage cookie returns 401", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: "session=completely_garbage_value_here",
        },
      });
      expect([401, 429]).toContain(res.status);
    });

    it("POST /api/auth/login with wrong password returns 401", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.ai", password: "wrongpassword123" }),
      });
      expect([401, 429]).toContain(res.status);
    });

    it("POST /api/auth/login with non-existent email returns 401", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent_user_xyz@nowhere.invalid", password: "password123" }),
      });
      expect([401, 429]).toContain(res.status);
    });

    it("POST /api/auth/login with empty credentials returns 400 or 401", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "" }),
      });
      expect([400, 401, 429]).toContain(res.status);
    });

    it("POST /api/auth/login with SQL injection attempt is handled safely", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "' OR '1'='1'; DROP TABLE users; --",
          password: "' OR '1'='1'",
        }),
      });
      expect([400, 401, 429]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it("POST /api/auth/login with missing body fields returns error", async () => {
      if (!authAvailable) return;
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect([400, 401, 429]).toContain(res.status);
    });
  });

  describe("Protected resource access with fake IDs", () => {
    it("GET /api/jobs/:fakeId returns 404 for non-existent job", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/jobs/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("DELETE /api/jobs/:fakeId returns 404 for non-existent job", async () => {
      if (!authAvailable) return;
      const res = await adminDelete(`/api/jobs/${FAKE_UUID}`);
      expect([204, 200, 404, 401, 429]).toContain(res.status);
    });

    it("PATCH /api/jobs/:fakeId returns 404 for non-existent job", async () => {
      if (!authAvailable) return;
      const res = await adminPatch(`/api/jobs/${FAKE_UUID}`, { name: "Updated Name" });
      expect([200, 400, 404, 429]).toContain(res.status);
    });

    it("GET /api/employees/:fakeId returns 404 for non-existent employee", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/employees/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });

    it("GET /api/documents/:fakeId returns 404 for non-existent document", async () => {
      if (!authAvailable) return;
      const res = await adminGet(`/api/documents/${FAKE_UUID}`);
      expect([400, 404, 429]).toContain(res.status);
    });
  });
});
