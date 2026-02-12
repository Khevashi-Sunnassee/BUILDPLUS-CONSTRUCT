import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:5000";
let sessionCookie = "";
let csrfToken = "";

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  sessionCookie = cookies
    .map((c: string) => c.split(";")[0])
    .join("; ");
  const csrfCookie = cookies.find((c: string) => c.includes("csrf_token"));
  if (csrfCookie) {
    csrfToken = csrfCookie.split("=")[1].split(";")[0];
  }
  return res;
}

async function authGet(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: sessionCookie },
  });
}

beforeAll(async () => {
  await login();
});

describe("API Endpoints - Authentication", () => {
  it("POST /api/auth/login should return user on valid credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("admin@buildplus.ai");
    expect(data.user.role).toBe("ADMIN");
  });

  it("POST /api/auth/login should reject invalid credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.ai", password: "wrong" }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it("GET /api/auth/me should return current user when authenticated", async () => {
    const res = await authGet("/api/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user?.email || data.email).toBe("admin@buildplus.ai");
  });

  it("GET /api/auth/me should return 401 when not authenticated", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    expect(res.status).toBe(401);
  });
});

describe("API Endpoints - Core Resources", () => {
  it("GET /api/dashboard/stats should return dashboard data", async () => {
    const res = await authGet("/api/dashboard/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("todayMinutes");
    expect(data).toHaveProperty("pendingDays");
  });

  it("GET /api/jobs should return array of jobs", async () => {
    const res = await authGet("/api/jobs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/panels should return array of panels", async () => {
    const res = await authGet("/api/panels");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/task-groups should return array", async () => {
    const res = await authGet("/api/task-groups");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/chat/conversations should return array", async () => {
    const res = await authGet("/api/chat/conversations");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/users should return array of users", async () => {
    const res = await authGet("/api/users");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("GET /api/load-lists should return array", async () => {
    const res = await authGet("/api/load-lists");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/purchase-orders should return array", async () => {
    const res = await authGet("/api/purchase-orders");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/production-slots should return array", async () => {
    const res = await authGet("/api/production-slots");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/eot-claims should return array", async () => {
    const res = await authGet("/api/eot-claims");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Admin Routes", () => {
  it("GET /api/admin/settings should return settings object", async () => {
    const res = await authGet("/api/admin/settings");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("companyId");
  });

  it("GET /api/admin/factories should return array", async () => {
    const res = await authGet("/api/admin/factories");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/checklist/entity-types should return array", async () => {
    const res = await authGet("/api/checklist/entity-types");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/broadcast-templates should return array", async () => {
    const res = await authGet("/api/broadcast-templates");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Help System", () => {
  it("GET /api/help/recent should return array", async () => {
    const res = await authGet("/api/help/recent");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/help/search?q=dashboard should return results", async () => {
    const res = await authGet("/api/help/search?q=dashboard");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Documents", () => {
  it("GET /api/documents should return paginated results", async () => {
    const res = await authGet("/api/documents?page=1&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("documents");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.documents)).toBe(true);
  });
});

describe("API Endpoints - Security", () => {
  it("unauthenticated requests to protected routes should return 401", async () => {
    const protectedRoutes = [
      "/api/jobs",
      "/api/panels",
      "/api/users",
      "/api/dashboard/stats",
      "/api/admin/settings",
    ];
    for (const route of protectedRoutes) {
      const res = await fetch(`${BASE_URL}${route}`);
      expect(res.status).toBe(401);
    }
  });

  it("POST without CSRF token should be rejected", async () => {
    const res = await fetch(`${BASE_URL}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(403);
  });
});
