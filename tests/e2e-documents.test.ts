import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPatch,
  adminDelete,
  uniqueName,
} from "./e2e-helpers";

let authAvailable = false;
let documentTypeId = "";
let statusId = "";
let disciplineId = "";
let categoryId = "";

describe("E2E: Document Type Management", () => {
  const typeName = uniqueName("DOCTYPE");

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
  });

  it("should create a document type", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/document-types", {
      companyId: "1",
      typeName,
      prefix: typeName.slice(0, 5),
      isActive: true,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    documentTypeId = data.id;
    expect(data.typeName).toBe(typeName);
  });

  it("should list document types and find the new one", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/document-types");
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = data.find((t: { id: string }) => t.id === documentTypeId);
    expect(found).toBeDefined();
  });

  it("should get active document types", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/document-types/active");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should update the document type", async () => {
    if (!authAvailable) return;
    const res = await adminPatch(`/api/document-types/${documentTypeId}`, {
      description: "E2E updated description",
    });
    expect(res.status).toBe(200);
  });
});

describe("E2E: Document Type Status Workflow", () => {
  it("should list auto-created statuses for the type", async () => {
    if (!authAvailable) return;
    if (!documentTypeId) return;
    const res = await adminGet(`/api/document-types/${documentTypeId}/statuses`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(2);
    statusId = data[0]?.id;
  });

  it("should create an additional status", async () => {
    if (!authAvailable) return;
    if (!documentTypeId) return;
    const res = await adminPost(`/api/document-types/${documentTypeId}/statuses`, {
      companyId: "1",
      typeId: documentTypeId,
      statusName: "E2E Review",
      color: "#f59e0b",
      sortOrder: 2,
      isDefault: false,
      isActive: true,
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    statusId = data.id;
    expect(data.statusName).toBe("E2E Review");
  });

  it("should update the status", async () => {
    if (!authAvailable) return;
    if (!statusId) return;
    const res = await adminPatch(`/api/document-types/${documentTypeId}/statuses/${statusId}`, {
      statusName: "E2E Reviewed",
      color: "#22c55e",
    });
    expect(res.status).toBe(200);
  });
});

describe("E2E: Document Discipline Management", () => {
  const discName = uniqueName("DISC");

  it("should create a discipline", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/document-disciplines", {
      companyId: "1",
      disciplineName: discName,
      shortForm: discName.slice(0, 5),
      isActive: true,
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    disciplineId = data.id;
    expect(data.disciplineName).toBe(discName);
  });

  it("should list disciplines", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/document-disciplines");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((d: { id: string }) => d.id === disciplineId);
    expect(found).toBeDefined();
  });

  it("should get active disciplines", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/document-disciplines/active");
    expect(res.status).toBe(200);
  });
});

describe("E2E: Document Category Management", () => {
  const catName = uniqueName("CAT");

  it("should create a category", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/document-categories", {
      companyId: "1",
      categoryName: catName,
      shortForm: catName.slice(0, 5),
      isActive: true,
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    categoryId = data.id;
    expect(data.categoryName).toBe(catName);
  });

  it("should list categories", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/document-categories");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("E2E: Document Listing", () => {
  it("should list documents (paginated)", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/documents");
    expect(res.status).toBe(200);
  });
});

describe("E2E: Document Config Cleanup", () => {
  it("should delete the custom status", async () => {
    if (!authAvailable) return;
    if (!statusId || !documentTypeId) return;
    const res = await adminDelete(`/api/document-types/${documentTypeId}/statuses/${statusId}`);
    expect(res.status).toBe(200);
  });

  it("should delete the document type", async () => {
    if (!authAvailable) return;
    if (!documentTypeId) return;
    const res = await adminDelete(`/api/document-types/${documentTypeId}`);
    expect(res.status).toBe(200);
  });

  it("should delete the discipline", async () => {
    if (!authAvailable) return;
    if (!disciplineId) return;
    const res = await adminDelete(`/api/document-disciplines/${disciplineId}`);
    expect(res.status).toBe(200);
  });

  it("should delete the category", async () => {
    if (!authAvailable) return;
    if (!categoryId) return;
    const res = await adminDelete(`/api/document-categories/${categoryId}`);
    expect(res.status).toBe(200);
  });
});
