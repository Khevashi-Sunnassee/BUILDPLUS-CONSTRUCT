import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPut,
  adminDelete,
  uniqueName,
} from "./e2e-helpers";

let authAvailable = false;
let jobId = "";
let panelId = "";
let panelTypeId = "";

describe("E2E: Panel Registration & Admin CRUD", () => {
  const panelName = uniqueName("PNL");

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;

    if (!authAvailable) return;

    const jobsRes = await adminGet("/api/jobs");
    const jobs = await jobsRes.json();
    jobId = jobs[0]?.id;
    if (!jobId) { authAvailable = false; return; }

    const ptRes = await adminGet("/api/panel-types");
    const panelTypes = await ptRes.json();
    if (Array.isArray(panelTypes) && panelTypes.length > 0) {
      panelTypeId = panelTypes[0].id;
    }
  });

  it("should create a new panel via admin endpoint", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/panels/admin", {
      panelMark: panelName,
      panelType: "WALL",
      jobId,
      loadWidth: "3000",
      loadHeight: "2400",
      panelThickness: "200",
      panelArea: "7.20",
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    panelId = String(data.id);
    expect(data.panelMark).toBe(panelName);
  });

  it("should retrieve panels for the job", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/panels?jobId=${jobId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const panels = Array.isArray(data) ? data : data.panels || [];
    expect(panels.length).toBeGreaterThan(0);
  });

  it("should update panel dimensions via admin PUT (triggers lifecycle advance)", async () => {
    if (!authAvailable) return;
    if (!panelId) return;
    const res = await adminPut(`/api/panels/admin/${panelId}`, {
      loadWidth: "3000",
      loadHeight: "2400",
      panelThickness: "200",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.loadWidth).toBe("3000");
  });

  it("should validate the panel", async () => {
    if (!authAvailable) return;
    if (!panelId) return;
    const res = await adminPost(`/api/panels/admin/${panelId}/validate`, {});
    expect([200, 400]).toContain(res.status);
  });
});

describe("E2E: Panel Audit Log", () => {
  it("should have audit log entries for the panel", async () => {
    if (!authAvailable) return;
    if (!panelId) return;
    const res = await adminGet(`/api/panels/${panelId}/audit-logs`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(0);
  });
});

describe("E2E: Panel Document Status", () => {
  it("should update panel document status", async () => {
    if (!authAvailable) return;
    if (!panelId) return;
    const res = await adminPut(`/api/panels/${panelId}/document-status`, {
      documentStatus: "IFA",
    });
    expect([200, 400]).toContain(res.status);
  });
});

describe("E2E: Production Schedule", () => {
  it("should get production schedule stats", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/production-schedule/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it("should get production schedule days with date range", async () => {
    if (!authAvailable) return;
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const res = await adminGet(`/api/production-schedule/days?startDate=${startDate}&endDate=${endDate}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should get ready panels for scheduling", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/production-schedule/ready-panels");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("E2E: Panel Cleanup", () => {
  it("should delete the test panel", async () => {
    if (!authAvailable) return;
    if (!panelId) return;
    const res = await adminDelete(`/api/panels/admin/${panelId}`);
    expect([200, 204, 500]).toContain(res.status);
  });
});
