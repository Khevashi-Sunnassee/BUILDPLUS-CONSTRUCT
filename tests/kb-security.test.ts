import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:5000";

describe("Knowledge Base Security", () => {
  describe("Rate Limiting", () => {
    it("should return rate limit headers on KB chat endpoint", async () => {
      const res = await fetch(`${BASE_URL}/api/kb/conversations/nonexistent/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "test", mode: "KB_ONLY" }),
      });
      const rateLimitHeader = res.headers.get("ratelimit-limit") || res.headers.get("x-ratelimit-limit");
      expect(rateLimitHeader).toBeTruthy();
    });
  });

  describe("CSRF Protection", () => {
    it("should reject KB chat POST without CSRF token for authenticated sessions", async () => {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@buildplus.com", password: "admin123" }),
      });

      const cookies = loginRes.headers.getSetCookie?.() || [];
      const cookieStr = cookies.join("; ");

      if (loginRes.ok && cookieStr) {
        const chatRes = await fetch(`${BASE_URL}/api/kb/conversations/test-id/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": cookieStr,
          },
          body: JSON.stringify({ content: "Hello", mode: "KB_ONLY" }),
        });

        expect(chatRes.status).toBe(403);
        const data = await chatRes.json();
        expect(data.error).toContain("CSRF");
      }
    });
  });

  describe("Input Validation", () => {
    it("should reject unauthenticated empty message content with 401", async () => {
      const res = await fetch(`${BASE_URL}/api/kb/conversations/test-id/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "", mode: "KB_ONLY" }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated oversized messages with 401", async () => {
      const longContent = "a".repeat(10001);
      const res = await fetch(`${BASE_URL}/api/kb/conversations/test-id/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: longContent, mode: "KB_ONLY" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Authentication", () => {
    it("should reject unauthenticated requests to KB projects", async () => {
      const res = await fetch(`${BASE_URL}/api/kb/projects`);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated requests to KB conversations", async () => {
      const res = await fetch(`${BASE_URL}/api/kb/conversations`);
      expect(res.status).toBe(401);
    });
  });
});
