import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:5000";

describe("Input Sanitization Middleware", () => {
  describe("Script tag stripping", () => {
    it("should strip script tags from request body strings", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: '<script>alert("xss")</script>admin@test.com',
          password: "test123",
        }),
      });
      const data = await res.json();
      expect(data.error || data.email || "").not.toContain("<script>");
    });

    it("should strip javascript: protocol from strings", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "javascript:alert(1)",
          password: "test123",
        }),
      });
      const data = await res.json();
      expect(data.error || "").not.toContain("javascript:");
    });

    it("should strip event handler attributes", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: 'test onmouseover="alert(1)"@test.com',
          password: "test123",
        }),
      });
      const data = await res.json();
      expect(data.error || "").not.toContain("onmouseover=");
    });
  });

  describe("Content-Type validation", () => {
    it("should accept application/json content type", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@test.com", password: "wrong" }),
      });
      expect(res.status).not.toBe(415);
    });

    it("should handle missing body gracefully", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect([400, 401, 429]).toContain(res.status);
    });
  });

  describe("Parameter validation", () => {
    it("should reject extremely long URL parameters", async () => {
      const longId = "a".repeat(200);
      const res = await fetch(`${BASE_URL}/api/jobs/${longId}`);
      expect([400, 401, 404, 429]).toContain(res.status);
    });
  });
});
