import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import {
  sendSuccess, sendCreated, sendNoContent, sendBadRequest,
  sendNotFound, sendForbidden, sendServerError, sendPaginated,
  sendUnauthorized, sendConflict, sendTooManyRequests,
} from "../../lib/api-response";

function createResponseApp() {
  const app = express();
  app.use(express.json());

  app.get("/test/success", (_req, res) => sendSuccess(res, { items: [1, 2, 3] }));
  app.post("/test/created", (_req, res) => sendCreated(res, { id: "new-1" }));
  app.delete("/test/no-content", (_req, res) => sendNoContent(res));
  app.get("/test/bad-request", (_req, res) => sendBadRequest(res, "Missing field"));
  app.get("/test/unauthorized", (_req, res) => sendUnauthorized(res));
  app.get("/test/forbidden", (_req, res) => sendForbidden(res));
  app.get("/test/not-found", (_req, res) => sendNotFound(res, "Item not found"));
  app.get("/test/conflict", (_req, res) => sendConflict(res, "Already exists"));
  app.get("/test/rate-limit", (_req, res) => sendTooManyRequests(res));
  app.get("/test/server-error", (_req, res) => sendServerError(res));
  app.get("/test/paginated", (_req, res) => {
    sendPaginated(res, [{ id: 1 }, { id: 2 }], { page: 1, limit: 10, total: 50 });
  });

  return app;
}

describe("API Response Helpers Integration", () => {
  const app = createResponseApp();

  it("sendSuccess returns 200 with JSON body", async () => {
    const res = await request(app).get("/test/success");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [1, 2, 3] });
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("sendCreated returns 201 with created resource", async () => {
    const res = await request(app).post("/test/created");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "new-1" });
  });

  it("sendNoContent returns 204 with empty body", async () => {
    const res = await request(app).delete("/test/no-content");
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
  });

  it("sendBadRequest returns 400 with error message", async () => {
    const res = await request(app).get("/test/bad-request");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Missing field" });
  });

  it("sendUnauthorized returns 401", async () => {
    const res = await request(app).get("/test/unauthorized");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("sendForbidden returns 403", async () => {
    const res = await request(app).get("/test/forbidden");
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error");
  });

  it("sendNotFound returns 404", async () => {
    const res = await request(app).get("/test/not-found");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Item not found" });
  });

  it("sendConflict returns 409", async () => {
    const res = await request(app).get("/test/conflict");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Already exists" });
  });

  it("sendTooManyRequests returns 429", async () => {
    const res = await request(app).get("/test/rate-limit");
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty("error");
  });

  it("sendServerError returns 500", async () => {
    const res = await request(app).get("/test/server-error");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });

  it("sendPaginated returns data with pagination metadata", async () => {
    const res = await request(app).get("/test/paginated");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      pagination: { page: 1, limit: 10, total: 50, totalPages: 5 },
    });
  });
});
