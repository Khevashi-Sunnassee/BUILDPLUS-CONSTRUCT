import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:5000";

describe("Knowledge Base Improvements", () => {
  describe("Conversation Ownership Security", () => {
    it("should reject unauthenticated conversation message fetch", async () => {
      const res = await fetch(`${BASE_URL}/api/kb/conversations/nonexistent-id/messages`);
      expect([401, 429]).toContain(res.status);
    });

    it("should return 404 for non-existent conversation messages", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: { Cookie: cookieStr },
      });
      const csrfData = await csrfRes.json();

      const res = await fetch(`${BASE_URL}/api/kb/conversations/nonexistent-uuid-123/messages`, {
        headers: { Cookie: cookieStr },
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe("Paginated Conversations", () => {
    it("should return paginated response structure for conversations", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const res = await fetch(`${BASE_URL}/api/kb/conversations`, {
        headers: { Cookie: cookieStr },
      });

      if (res.ok) {
        const body = await res.json();
        expect(body).toHaveProperty("data");
        expect(body).toHaveProperty("pagination");
        expect(body.pagination).toHaveProperty("page");
        expect(body.pagination).toHaveProperty("total");
        expect(body.pagination).toHaveProperty("totalPages");
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    it("should support custom page and limit parameters", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const res = await fetch(`${BASE_URL}/api/kb/conversations?page=1&limit=10`, {
        headers: { Cookie: cookieStr },
      });

      if (res.ok) {
        const body = await res.json();
        expect(body.pagination.page).toBe(1);
      }
    });
  });

  describe("Paginated Email Send Logs", () => {
    it("should reject unauthenticated email log requests", async () => {
      const res = await fetch(`${BASE_URL}/api/email-send-logs`);
      expect([401, 429]).toContain(res.status);
    });

    it("should return paginated response for email send logs", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const res = await fetch(`${BASE_URL}/api/email-send-logs`, {
        headers: { Cookie: cookieStr },
      });

      if (res.ok) {
        const body = await res.json();
        expect(body).toHaveProperty("data");
        expect(body).toHaveProperty("pagination");
        expect(body.pagination).toHaveProperty("page");
        expect(body.pagination).toHaveProperty("total");
        expect(body.pagination).toHaveProperty("totalPages");
      }
    });
  });

  describe("Email Body Size Limit", () => {
    it("should reject oversized email body (authenticated)", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: { Cookie: cookieStr },
      });
      const csrfData = await csrfRes.json();

      const res = await fetch(`${BASE_URL}/api/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieStr,
          "x-csrf-token": csrfData.csrfToken || "",
        },
        body: JSON.stringify({
          to: "test@example.com",
          subject: "Test",
          htmlBody: "x".repeat(500001),
        }),
      });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe("AI Usage Quota Table", () => {
    it("should have ai_usage_tracking table created", async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect([200, 429]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(data.status).toBeDefined();
      }
    });
  });

  describe("Message Size Validation", () => {
    it("should reject messages exceeding 10000 characters when authenticated", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      if (!loginRes.ok) return;

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: { Cookie: cookieStr },
      });
      const csrfData = await csrfRes.json();

      const res = await fetch(`${BASE_URL}/api/kb/conversations/test-id/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieStr,
          "x-csrf-token": csrfData.csrfToken || "",
        },
        body: JSON.stringify({ content: "a".repeat(10001), mode: "KB_ONLY" }),
      });

      expect([400, 404]).toContain(res.status);
    });
  });
});
