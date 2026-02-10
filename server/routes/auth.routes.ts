import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { loginSchema } from "@shared/schema";
import { requireAuth } from "./middleware/auth.middleware";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", issues: result.error.issues });
    }
    const user = await storage.getUserByEmail(result.data.email);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await storage.validatePassword(user, result.data.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    req.session.userId = user.id;
    req.session.companyId = user.companyId;
    req.session.name = user.name ?? undefined;
    res.json({ user: { ...user, passwordHash: undefined } });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await storage.getUser(req.session.userId!);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({ user: { ...user, passwordHash: undefined } });
});

export const authRouter = router;
