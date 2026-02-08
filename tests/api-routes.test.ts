import { describe, it, expect } from "vitest";
import {
  AUTH_ROUTES,
  USER_ROUTES,
  JOBS_ROUTES,
  PANELS_ROUTES,
  TASKS_ROUTES,
  CHAT_ROUTES,
  LOGISTICS_ROUTES,
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
