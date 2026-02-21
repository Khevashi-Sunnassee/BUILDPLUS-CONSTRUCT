import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { sendSuccess, sendBadRequest, sendNotFound, sendForbidden, sendCreated } from "../../lib/api-response";

function createCrudApp() {
  const app = express();
  app.use(express.json());

  const items = new Map<string, { id: string; name: string; companyId: string }>();
  items.set("item-1", { id: "item-1", name: "Widget A", companyId: "co-1" });
  items.set("item-2", { id: "item-2", name: "Widget B", companyId: "co-1" });
  items.set("item-3", { id: "item-3", name: "Widget C", companyId: "co-2" });

  app.use((req: any, _res, next) => {
    req.companyId = "co-1";
    req.session = { userId: "user-1" };
    next();
  });

  app.get("/api/items", (req: any, res) => {
    const companyId = req.companyId;
    if (!companyId) return sendBadRequest(res, "Company context required");
    const filtered = Array.from(items.values()).filter(i => i.companyId === companyId);
    sendSuccess(res, filtered);
  });

  app.get("/api/items/:id", (req: any, res) => {
    const item = items.get(req.params.id);
    if (!item) return sendNotFound(res, "Item not found");
    if (item.companyId !== req.companyId) return sendForbidden(res);
    sendSuccess(res, item);
  });

  app.post("/api/items", (req: any, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return sendBadRequest(res, "Name is required");
    }
    const id = `item-${Date.now()}`;
    const item = { id, name, companyId: req.companyId };
    items.set(id, item);
    sendCreated(res, item);
  });

  app.delete("/api/items/:id", (req: any, res) => {
    const item = items.get(req.params.id);
    if (!item) return sendNotFound(res, "Item not found");
    if (item.companyId !== req.companyId) return sendForbidden(res);
    items.delete(req.params.id);
    sendSuccess(res, { ok: true });
  });

  return app;
}

describe("CRUD Pattern Integration", () => {
  const app = createCrudApp();

  it("GET /api/items returns only company-scoped items", async () => {
    const res = await request(app).get("/api/items");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i: any) => i.companyId === "co-1")).toBe(true);
  });

  it("GET /api/items/:id returns single item", async () => {
    const res = await request(app).get("/api/items/item-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Widget A");
  });

  it("GET /api/items/:id returns 404 for nonexistent", async () => {
    const res = await request(app).get("/api/items/item-999");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Item not found");
  });

  it("GET /api/items/:id returns 403 for wrong company", async () => {
    const res = await request(app).get("/api/items/item-3");
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/items creates new item with 201", async () => {
    const res = await request(app).post("/api/items").send({ name: "New Widget" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("name", "New Widget");
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("companyId", "co-1");
  });

  it("POST /api/items returns 400 without name", async () => {
    const res = await request(app).post("/api/items").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Name is required");
  });

  it("POST /api/items returns 400 with empty name", async () => {
    const res = await request(app).post("/api/items").send({ name: "  " });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/items/:id returns 404 for nonexistent", async () => {
    const res = await request(app).delete("/api/items/item-999");
    expect(res.status).toBe(404);
  });

  it("DELETE /api/items/:id returns 403 for wrong company", async () => {
    const res = await request(app).delete("/api/items/item-3");
    expect(res.status).toBe(403);
  });

  it("response format is consistent JSON with error field on failures", async () => {
    const notFoundRes = await request(app).get("/api/items/nope");
    expect(notFoundRes.body).toHaveProperty("error");
    expect(typeof notFoundRes.body.error).toBe("string");

    const badReqRes = await request(app).post("/api/items").send({});
    expect(badReqRes.body).toHaveProperty("error");
    expect(typeof badReqRes.body.error).toBe("string");
  });
});
