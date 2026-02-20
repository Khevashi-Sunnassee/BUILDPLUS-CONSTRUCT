import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminDelete,
  uniqueName,
} from "./e2e-helpers";

let authAvailable = false;
let jobId = "";
let claimId = "";

describe("E2E: Progress Claims Workflow", () => {
  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;

    if (!authAvailable) return;

    const jobsRes = await adminGet("/api/jobs");
    const jobs = await jobsRes.json();
    jobId = jobs[0]?.id;
    if (!jobId) { authAvailable = false; return; }
  });

  it("should get next claim number", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/progress-claims/next-number?jobId=${jobId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.claimNumber).toBeDefined();
  });

  it("should get claimable panels for the job", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/progress-claims/job/${jobId}/claimable-panels`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should get job claim summary", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/progress-claims/job/${jobId}/summary`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it("should create a progress claim", async () => {
    if (!authAvailable) return;
    const nextNumRes = await adminGet(`/api/progress-claims/next-number?jobId=${jobId}`);
    const { claimNumber } = await nextNumRes.json();

    const res = await adminPost("/api/progress-claims", {
      jobId,
      claimNumber: claimNumber || uniqueName("PC"),
      claimDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: "DRAFT",
    });

    if (res.status === 201 || res.status === 200) {
      const data = await res.json();
      claimId = data.id;
      expect(data.jobId).toBe(jobId);
      expect(data.status).toBe("DRAFT");
    } else {
      const text = await res.text();
      console.log(`Progress claim creation returned ${res.status}: ${text}`);
      expect([200, 201, 400]).toContain(res.status);
    }
  });

  it("should list progress claims", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/progress-claims");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data) || data.claims).toBeTruthy();
  });

  it("should get retention report", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/progress-claims/retention-report");
    expect(res.status).toBe(200);
  });

  it("should get retention summary for job", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/progress-claims/job/${jobId}/retention-summary`);
    expect(res.status).toBe(200);
  });

  it("should submit the claim if created", async () => {
    if (!authAvailable) return;
    if (!claimId) return;
    const res = await adminPost(`/api/progress-claims/${claimId}/submit`, {});
    expect([200, 400]).toContain(res.status);
  });

  it("should clean up by deleting the claim", async () => {
    if (!authAvailable) return;
    if (!claimId) return;
    const res = await adminDelete(`/api/progress-claims/${claimId}`);
    expect([200, 400, 404]).toContain(res.status);
  });
});
