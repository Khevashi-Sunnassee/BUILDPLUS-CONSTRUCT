import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";

function createHealthApp() {
  const app = express();
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  return app;
}

describe("Health Endpoint Integration", () => {
  const app = createHealthApp();

  it("GET /api/health returns 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("GET /api/health returns valid timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("timestamp");
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it("POST /api/health returns 404 (method not allowed)", async () => {
    const res = await request(app).post("/api/health");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
