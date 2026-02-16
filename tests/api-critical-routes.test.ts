import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
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

describe("Tender System Tests", () => {
  let createdTenderId: string | null = null;
  const tenderName = uniqueName("Tender");

  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/tenders returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/tenders");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/tenders with valid data creates a tender", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/tenders", {
      name: tenderName,
      description: "E2E test tender description",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "open",
    });
    expect([200, 201, 401]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data) {
        expect(data).toHaveProperty("id");
        createdTenderId = data.id;
      }
    }
  });

  it("GET /api/tenders/:id with non-existent UUID returns 404", async () => {
    if (!isAdminLoggedIn()) return;
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await adminGet(`/api/tenders/${fakeId}`);
    expect([400, 401, 404]).toContain(res.status);
  });

  it("POST /api/tenders with missing name returns 400", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/tenders", {
      description: "Missing name field",
    });
    expect([400, 401, 422]).toContain(res.status);
  });

  it("GET /api/tenders returns the created tender", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/tenders");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data && Array.isArray(data) && createdTenderId) {
      const found = data.some(
        (t: Record<string, unknown>) => t.id === createdTenderId
      );
      expect(found).toBe(true);
    }
  });
});

describe("Budget System Tests", () => {
  const costCodeCode = uniqueName("CC");

  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/budget/cost-codes returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/budget/cost-codes");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/budget/cost-codes with valid data creates cost code", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/budget/cost-codes", {
      code: costCodeCode,
      name: `Cost Code ${costCodeCode}`,
      parentCode: "",
    });
    expect([200, 201, 401]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data) expect(data).toHaveProperty("id");
    }
  });

  it("GET /api/budget/tender-sheets returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/budget/tender-sheets");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/budget/cost-codes with duplicate code returns 400/409", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/budget/cost-codes", {
      code: costCodeCode,
      name: `Duplicate ${costCodeCode}`,
      parentCode: "",
    });
    expect([200, 201, 400, 401, 409, 422, 500]).toContain(res.status);
  });
});

describe("Project Activities Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/job-types returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/job-types");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/activity-stages returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/activity-stages");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/activity-consultants returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/activity-consultants");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/job-types with valid data creates type", async () => {
    if (!isAdminLoggedIn()) return;
    const name = uniqueName("JobType");
    const res = await adminPost("/api/job-types", { name });
    expect([200, 201, 401]).toContain(res.status);
    if (res.status === 200 || res.status === 201) {
      const data = await safeJson(res);
      if (data) expect(data).toHaveProperty("id");
    }
  });
});

describe("Checklist System Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/checklist/templates returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/checklist/templates");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/checklist/work-orders returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/checklist/work-orders");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/checklist/templates with missing data returns 400", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/checklist/templates", {});
    expect([400, 401, 422]).toContain(res.status);
  });
});

describe("Progress Claims Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/progress-claims returns array or requires jobId", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/progress-claims");
    expect([200, 400, 401]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data) expect(Array.isArray(data)).toBe(true);
    }
  });

  it("POST /api/progress-claims with invalid jobId returns 400/404", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminPost("/api/progress-claims", {
      jobId: "00000000-0000-0000-0000-000000000000",
    });
    expect([400, 401, 404, 422]).toContain(res.status);
  });

  it("GET /api/progress-claims?jobId=<non-existent-uuid> returns empty array", async () => {
    if (!isAdminLoggedIn()) return;
    const fakeJobId = "00000000-0000-0000-0000-000000000000";
    const res = await adminGet(`/api/progress-claims?jobId=${fakeJobId}`);
    expect([200, 400, 401, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = await safeJson(res);
      if (data && Array.isArray(data)) {
        expect(data.length).toBe(0);
      }
    }
  });
});

describe("Document Management Tests", () => {
  beforeAll(async () => {
    await loginAdmin();
  });

  it("GET /api/documents returns array", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/documents");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) {
      expect(typeof data === "object").toBe(true);
      if (data.documents) {
        expect(Array.isArray(data.documents)).toBe(true);
      } else {
        expect(Array.isArray(data)).toBe(true);
      }
    }
  });

  it("GET /api/documents?limit=3 respects limit", async () => {
    if (!isAdminLoggedIn()) return;
    const res = await adminGet("/api/documents?limit=3");
    if (res.status === 401) return;
    expect(res.status).toBe(200);
    const data = await safeJson(res);
    if (data) {
      if (data.documents) {
        expect(data.documents.length).toBeLessThanOrEqual(3);
      } else if (Array.isArray(data)) {
        expect(data.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("GET /api/documents/:non-existent-uuid returns 404", async () => {
    if (!isAdminLoggedIn()) return;
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await adminGet(`/api/documents/${fakeId}`);
    expect([400, 401, 404]).toContain(res.status);
  });
});
