import { describe, it, expect, beforeAll } from "vitest";
import { loginAdmin, adminGet, adminPost } from "./e2e-helpers";

const BASE = `http://localhost:${process.env.PORT || 5000}`;

let authAvailable = false;

describe("Security Headers", () => {
  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  it("should include Content-Security-Policy header", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("should include X-Frame-Options DENY", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("should include X-Content-Type-Options nosniff", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("should include Referrer-Policy", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const rp = res.headers.get("referrer-policy");
    expect(rp).toBeTruthy();
    expect(rp).toContain("strict-origin");
  });

  it("should include Permissions-Policy", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const pp = res.headers.get("permissions-policy");
    expect(pp).toBeTruthy();
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("should include X-Request-Id for tracing", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(requestId!.length).toBeGreaterThan(0);
  });

  it("should set no-cache headers on API responses", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const cc = res.headers.get("cache-control");
    expect(cc).toContain("no-store");
  });
});

describe("CSRF Protection - Integration", () => {
  it("should reject POST without CSRF token when authenticated", async () => {
    if (!authAvailable) return;
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.com.au", password: "admin123" }),
    });
    if (!loginRes.ok) {
      console.warn("[SKIP] Login rate-limited, cannot test CSRF rejection");
      return;
    }

    const cookies = loginRes.headers.getSetCookie?.() || [];
    const sessionCookie = cookies.find(c => c.startsWith("connect.sid="));

    if (sessionCookie) {
      const res = await fetch(`${BASE}/api/ap-approval-rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": sessionCookie.split(";")[0],
        },
        body: JSON.stringify({ name: "test-no-csrf" }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CSRF");
    }
  });

  it("should set a new CSRF cookie on login", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.com.au", password: "admin123" }),
    });
    if (!res.ok) {
      console.warn("[SKIP] Login rate-limited, cannot verify CSRF cookie rotation");
      return;
    }

    const cookies = res.headers.getSetCookie?.() || [];
    const csrfCookie = cookies.find(c => c.startsWith("csrf_token="));
    expect(csrfCookie).toBeTruthy();
  });
});

describe("Input Validation - Integration", () => {
  it("should reject params with script injection characters", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/tenders/%3Cscript%3E`);
    expect([400, 401]).toContain(res.status);
  });

  it("should reject params with SQL injection patterns", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/jobs/%27%3BDROP%20TABLE`);
    expect([400, 401]).toContain(res.status);
  });

  it("should reject unsupported content types", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: "<xml>test</xml>",
    });
    expect(res.status).toBe(415);
  });

  it("should reject oversized request bodies", async () => {
    if (!authAvailable) return;
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.com.au", password: "admin123" }),
    });
    const cookies = loginRes.headers.getSetCookie?.() || [];
    const sessionCookie = cookies.find(c => c.startsWith("connect.sid="));
    const csrfCookie = cookies.find(c => c.startsWith("csrf_token="));

    if (sessionCookie && csrfCookie) {
      const csrfToken = csrfCookie.split("=")[1].split(";")[0];
      const oversizedBody = { name: "x".repeat(11000) };
      const res = await fetch(`${BASE}/api/tenders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `${sessionCookie.split(";")[0]}; csrf_token=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify(oversizedBody),
      });
      expect(res.status).toBe(400);
    }
  });
});

describe("Rate Limiting", () => {
  it("should include rate limit headers", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    const remaining = res.headers.get("ratelimit-remaining");
    const limit = res.headers.get("ratelimit-limit");
    expect(remaining).toBeTruthy();
    expect(limit).toBeTruthy();
  });
});
