import { describe, it, expect } from "vitest";
import {
  AUTH_ROUTES,
  USER_ROUTES,
  JOBS_ROUTES,
  PANELS_ROUTES,
  TASKS_ROUTES,
  CHAT_ROUTES,
  LOGISTICS_ROUTES,
  HELP_ROUTES,
  UPLOAD_ROUTES,
  ADMIN_ROUTES,
} from "@shared/api-routes";

describe("API Routes - Structure", () => {
  it("AUTH_ROUTES should define login, logout, me", () => {
    expect(AUTH_ROUTES.LOGIN).toBe("/api/auth/login");
    expect(AUTH_ROUTES.LOGOUT).toBe("/api/auth/logout");
    expect(AUTH_ROUTES.ME).toBe("/api/auth/me");
  });

  it("USER_ROUTES should define list and by-id", () => {
    expect(USER_ROUTES.LIST).toBe("/api/users");
    expect(typeof USER_ROUTES.BY_ID).toBe("function");
    expect(USER_ROUTES.BY_ID("123")).toBe("/api/users/123");
  });

  it("all static routes should start with /api/", () => {
    const routeGroups = [AUTH_ROUTES, USER_ROUTES];
    for (const group of routeGroups) {
      for (const [key, value] of Object.entries(group)) {
        if (typeof value === "string") {
          expect(value).toMatch(/^\/api\//);
        }
      }
    }
  });

  it("dynamic route functions should return paths starting with /api/", () => {
    expect(USER_ROUTES.BY_ID("test-id")).toMatch(/^\/api\//);
  });
});

describe("API Routes - Jobs", () => {
  it("should define standard CRUD routes", () => {
    expect(JOBS_ROUTES.LIST).toBeDefined();
    expect(typeof JOBS_ROUTES.BY_ID).toBe("function");
    expect(JOBS_ROUTES.BY_ID("abc")).toContain("abc");
  });
});

describe("API Routes - Panels", () => {
  it("should define panel list route", () => {
    expect(PANELS_ROUTES.LIST).toBeDefined();
    expect(PANELS_ROUTES.LIST).toMatch(/^\/api\//);
  });
});

describe("API Routes - Chat", () => {
  it("should define chat routes", () => {
    expect(CHAT_ROUTES).toBeDefined();
    expect(CHAT_ROUTES.CONVERSATIONS).toMatch(/^\/api\//);
  });
});

describe("API Routes - Logistics", () => {
  it("should define logistics routes", () => {
    expect(LOGISTICS_ROUTES).toBeDefined();
    expect(LOGISTICS_ROUTES.LOAD_LISTS).toMatch(/^\/api\//);
  });
});

describe("API Routes - Tasks", () => {
  it("should define task routes", () => {
    expect(TASKS_ROUTES).toBeDefined();
    expect(TASKS_ROUTES.GROUPS).toMatch(/^\/api\//);
  });
});

describe("API Routes - Help", () => {
  it("should define static help routes", () => {
    expect(HELP_ROUTES.SEARCH).toBe("/api/help/search");
    expect(HELP_ROUTES.RECENT).toBe("/api/help/recent");
    expect(HELP_ROUTES.CATEGORIES).toBe("/api/help/categories");
    expect(HELP_ROUTES.FEEDBACK).toBe("/api/help/feedback");
    expect(HELP_ROUTES.ADMIN_LIST).toBe("/api/help/admin");
  });

  it("should define dynamic help routes", () => {
    expect(HELP_ROUTES.BY_KEY("dashboard.overview")).toContain("dashboard.overview");
    expect(HELP_ROUTES.ADMIN_BY_ID(42)).toBe("/api/help/admin/42");
    expect(HELP_ROUTES.ADMIN_VERSIONS("5")).toBe("/api/help/admin/5/versions");
  });

  it("BY_KEY should URL-encode the key parameter", () => {
    expect(HELP_ROUTES.BY_KEY("key with spaces")).toContain("key%20with%20spaces");
  });

  it("all static help routes should start with /api/", () => {
    for (const [, value] of Object.entries(HELP_ROUTES)) {
      if (typeof value === "string") {
        expect(value).toMatch(/^\/api\//);
      }
    }
  });
});

describe("API Routes - Upload", () => {
  it("should define upload request URL route", () => {
    expect(UPLOAD_ROUTES.REQUEST_URL).toBe("/api/uploads/request-url");
  });
});

describe("API Routes - Admin", () => {
  it("should define admin job audit log route", () => {
    expect(ADMIN_ROUTES.JOB_AUDIT_LOG("job-123")).toBe("/api/admin/jobs/job-123/audit-log");
    expect(ADMIN_ROUTES.JOB_AUDIT_LOG(456)).toBe("/api/admin/jobs/456/audit-log");
  });

  it("should define admin jobs route", () => {
    expect(ADMIN_ROUTES.JOBS).toBe("/api/admin/jobs");
  });
});
