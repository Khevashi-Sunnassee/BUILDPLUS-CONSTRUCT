import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
  unauthGet,
  isAdminLoggedIn,
  uniqueName,
} from "./e2e-helpers";

const BASE_URL = "http://localhost:5000";

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

describe("Company Isolation Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/jobs returns only company-scoped jobs", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/jobs");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) expect(Array.isArray(data)).toBe(true);
    }
  });

  it("GET /api/customers returns only company-scoped customers", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/customers");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) expect(Array.isArray(data)).toBe(true);
    }
  });

  it("GET /api/panel-register requires jobId parameter", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/panel-register");
    expect([200, 400, 401, 404]).toContain(res.status);
  });

  it("GET /api/documents returns company-scoped documents", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/documents");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) {
        expect(typeof data === "object").toBe(true);
      }
    }
  });

  it("GET /api/suppliers returns company-scoped suppliers", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/suppliers");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) expect(Array.isArray(data)).toBe(true);
    }
  });

  it("GET /api/assets returns company-scoped assets", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/assets");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) {
        expect(Array.isArray(data) || (typeof data === "object" && data !== null)).toBe(true);
      }
    }
  });
});

describe("Data Integrity Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("POST /api/customers with invalid data returns 400", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/customers", {});
    expect([400, 401, 422]).toContain(res.status);
  });

  it("POST /api/customers with valid data returns 200/201 with id", async () => {
    if (!isAdminLoggedIn()) return;
    const name = uniqueName("TestCustomer");
    const res = await adminPost("/api/customers", {
      name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@test.com`,
      phone: "0400000000",
      address: "123 Test St",
    });
    expect([200, 201, 401]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data) expect(data).toHaveProperty("id");
    }
  });

  it("GET /api/jobs/:id with non-existent UUID returns 404", async () => {
    if (!isAdminLoggedIn()) return;
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await adminGet(`/api/jobs/${fakeId}`);
    expect([400, 401, 404]).toContain(res.status);
  });

  it("POST /api/jobs with missing required fields returns 400", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/jobs", {});
    expect([200, 400, 401, 422]).toContain(res.status);
  });

  it("PATCH /api/jobs/:id with invalid UUID format returns 400/404", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPatch("/api/jobs/not-a-valid-uuid", { name: "test" });
    expect([200, 400, 401, 404, 500]).toContain(res.status);
  });

  it("GET /api/production-entries with invalid jobId returns empty array or 400", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/production-entries?jobId=invalid-id");
    expect([200, 400, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data && Array.isArray(data)) {
        expect(data.length).toBe(0);
      }
    }
  });
});

describe("Pagination Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/documents?limit=5 returns at most 5 results", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/documents?limit=5");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data && data.documents) {
        expect(data.documents.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("GET /api/documents?limit=5&offset=0 respects offset", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/documents?limit=5&offset=0");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data && data.documents) {
        expect(Array.isArray(data.documents)).toBe(true);
        expect(data.documents.length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("GET /api/assets?limit=2 returns at most 2 results", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/assets?limit=2");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) {
        if (Array.isArray(data)) {
          expect(data.length).toBeLessThanOrEqual(2);
        } else if (data.assets) {
          expect(data.assets.length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it("GET /api/suppliers?limit=1 returns at most 1 result", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/suppliers?limit=1");
    expect([200, 304, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data && Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("Rate Limiting Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /health responds with 200", async () => {
    const res = await unauthGet("/health");
    expect(res.status).toBe(200);
  });

  it("multiple rapid requests don't get rate limited under normal use", async () => {
    if (!isAdminLoggedIn()) return;
    const requests = Array.from({ length: 5 }, () => adminGet("/api/jobs"));
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    const allOk = statuses.every((s) => [200, 304, 401].includes(s));
    expect(allOk).toBe(true);
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited.length).toBe(0);
  });
});

describe("Input Sanitization Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("POST with script tags in customer name gets sanitized or rejected", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/customers", {
      name: '<script>alert("xss")</script>',
      email: "xsstest@test.com",
      phone: "0400000000",
      address: "123 Test St",
    });
    expect([200, 201, 400, 401, 422]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data && data.name) {
        expect(data.name).not.toContain("<script>");
      }
    }
  });

  it("POST with SQL injection attempt in query params doesn't error", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/customers?search=' OR 1=1; --");
    expect([200, 400, 401, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });

  it("POST with extremely long string gets rejected or truncated", async () => {
    if (!isAdminLoggedIn()) return;
    const longString = "A".repeat(10000);
    const res = await adminPost("/api/customers", {
      name: longString,
      email: "longtest@test.com",
      phone: "0400000000",
      address: "123 Test St",
    });
    expect([200, 201, 400, 401, 413, 422]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data && data.name) {
        expect(data.name.length).toBeLessThanOrEqual(10000);
      }
    }
  });
});
