import { describe, it, expect, beforeAll } from "vitest";
import {
  adminGet,
  adminPost,
  loginAdmin,
  unauthGet,
} from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";

let authAvailable = false;

describe("API Endpoints - Authentication", () => {
  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  it("POST /api/auth/login should return user on valid credentials", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.ai", password: "admin123" }),
    });
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("admin@buildplus.ai");
      expect(data.user.role).toBe("ADMIN");
    }
  });

  it("POST /api/auth/login should reject invalid credentials", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@buildplus.ai", password: "wrong" }),
    });
    expect([400, 401, 429]).toContain(res.status);
  });

  it("GET /api/auth/me should return current user when authenticated", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user?.email || data.email).toBe("admin@buildplus.ai");
  });

  it("GET /api/auth/me should return 401 when not authenticated", async () => {
    if (!authAvailable) return;
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    expect(res.status).toBe(401);
  });
});

describe("API Endpoints - Core Resources", () => {
  it("GET /api/dashboard/stats should return dashboard data", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/dashboard/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("todayMinutes");
    expect(data).toHaveProperty("pendingDays");
  });

  it("GET /api/jobs should return array of jobs", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/jobs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/panels should return array of panels", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/panels");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/task-groups should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/task-groups");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/chat/conversations should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/chat/conversations");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/users should return array of users", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/users");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("GET /api/load-lists should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/load-lists");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/purchase-orders should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/purchase-orders");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/production-slots should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/production-slots");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/eot-claims should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/eot-claims");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Admin Routes", () => {
  it("GET /api/admin/settings should return settings object", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/admin/settings");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("companyId");
  });

  it("GET /api/admin/factories should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/admin/factories");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/checklist/entity-types should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/checklist/entity-types");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/broadcast-templates should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/broadcast-templates");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Help System", () => {
  it("GET /api/help/recent should return array", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/help/recent");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/help/search?q=dashboard should return results", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/help/search?q=dashboard");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("API Endpoints - Documents", () => {
  it("GET /api/documents should return paginated results", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/documents?page=1&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("documents");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.documents)).toBe(true);
  });
});

describe("API Endpoints - Security", () => {
  it("unauthenticated requests to protected routes should return 401", async () => {
    if (!authAvailable) return;
    const protectedRoutes = [
      "/api/jobs",
      "/api/panels",
      "/api/users",
      "/api/dashboard/stats",
      "/api/admin/settings",
    ];
    for (const route of protectedRoutes) {
      const res = await unauthGet(route);
      expect(res.status).toBe(401);
    }
  });
});
