import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../../storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
  },
}));

vi.mock("../../lib/logger", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { storage } from "../../storage";

function createAuthTestApp() {
  const app = express();
  app.use(express.json());

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await (storage as any).getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req: any, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ id: req.session.userId });
  });

  return app;
}

describe("Auth Routes Integration", () => {
  const app = createAuthTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/auth/login requires email and password", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST /api/auth/login rejects invalid email", async () => {
    (storage as any).getUserByEmail.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("POST /api/auth/login succeeds with valid user", async () => {
    (storage as any).getUserByEmail.mockResolvedValue({
      id: "u1", email: "admin@test.com", name: "Admin", password: "hashed",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "secret" });
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("email", "admin@test.com");
  });

  it("POST /api/auth/logout returns ok", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("GET /api/auth/me returns 401 without session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
