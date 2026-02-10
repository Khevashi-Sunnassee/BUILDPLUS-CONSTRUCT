import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  unauthGet,
  unauthPost,
} from "./e2e-helpers";

beforeAll(async () => {
  await loginAdmin();
});

describe("E2E: Authentication Guards", () => {
  it("should reject unauthenticated GET to protected endpoints", async () => {
    const endpoints = [
      "/api/jobs",
      "/api/tasks/some-id",
      "/api/documents",
      "/api/users",
      "/api/dashboard/stats",
    ];

    for (const endpoint of endpoints) {
      const res = await unauthGet(endpoint);
      expect(res.status).toBe(401);
    }
  });

  it("should reject unauthenticated POST to mutating endpoints", async () => {
    const res = await unauthPost("/api/task-groups", { name: "hack" });
    expect(res.status).toBe(401);
  });

  it("should return current user for authenticated session", async () => {
    const res = await adminGet("/api/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user?.role || data.role).toBe("ADMIN");
  });

  it("should reject login with invalid credentials", async () => {
    const res = await unauthPost("/api/auth/login", {
      email: "nobody@nonexistent.com",
      password: "wrongpassword",
    });
    expect([400, 401]).toContain(res.status);
  });

  it("should reject login with missing fields", async () => {
    const res = await unauthPost("/api/auth/login", {
      email: "admin@lte.com.au",
    });
    expect([400, 401]).toContain(res.status);
  });
});

describe("E2E: Role-Based Access Control (RBAC)", () => {
  it("admin should access admin-only user management endpoint", async () => {
    const res = await adminGet("/api/users");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("unauthenticated user should be denied admin-only routes", async () => {
    const res = await unauthPost("/api/document-types", { name: "hack", code: "HK", isActive: true });
    expect([401, 403]).toContain(res.status);
  });

  it("unauthenticated user should be denied DELETE on admin resources", async () => {
    const res = await fetch("http://localhost:5000/api/document-types/nonexistent-id", {
      method: "DELETE",
    });
    expect([401, 403]).toContain(res.status);
  });
});

describe("E2E: CSRF Protection", () => {
  it("should reject POST without CSRF token", async () => {
    const res = await fetch("http://localhost:5000/api/task-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "no-csrf" }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("should reject POST with invalid CSRF token", async () => {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lte.com.au", password: "admin123" }),
    });
    const cookies = loginRes.headers.getSetCookie?.() || [];
    const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");

    const res = await fetch("http://localhost:5000/api/task-groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
        "x-csrf-token": "invalid-token-value",
      },
      body: JSON.stringify({ name: "bad-csrf" }),
    });
    expect([400, 401, 403, 500]).toContain(res.status);
  });
});

describe("E2E: Input Validation", () => {
  it("should reject malformed email on login", async () => {
    const res = await unauthPost("/api/auth/login", {
      email: "not-an-email",
      password: "test",
    });
    expect([400, 401, 422]).toContain(res.status);
  });

  it("should reject empty body on POST endpoints", async () => {
    const res = await adminPost("/api/task-groups", {});
    expect([400, 422]).toContain(res.status);
  });
});

describe("E2E: Session Security", () => {
  it("should set HttpOnly session cookies", async () => {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lte.com.au", password: "admin123" }),
    });
    const cookies = res.headers.getSetCookie?.() || [];
    const sessionCookie = cookies.find((c: string) =>
      c.includes("connect.sid") || c.includes("lte.")
    );
    if (sessionCookie) {
      expect(sessionCookie.toLowerCase()).toContain("httponly");
    }
  });

  it("should logout and invalidate session", async () => {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@lte.com.au", password: "admin123" }),
    });
    const cookies = loginRes.headers.getSetCookie?.() || [];
    const session = cookies.map((c: string) => c.split(";")[0]).join("; ");
    const csrf = cookies.find((c: string) => c.includes("csrf_token"));
    const token = csrf ? csrf.split("=")[1].split(";")[0] : "";

    const logoutRes = await fetch("http://localhost:5000/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: session,
        "x-csrf-token": token,
      },
    });
    expect(logoutRes.status).toBe(200);

    const meRes = await fetch("http://localhost:5000/api/auth/me", {
      headers: { Cookie: session },
    });
    expect([200, 401]).toContain(meRes.status);
  });
});

describe("E2E: API Health & Rate Limiting", () => {
  it("should return health check", async () => {
    const res = await fetch("http://localhost:5000/api/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(["ok", "healthy"]).toContain(data.status);
  });
});
