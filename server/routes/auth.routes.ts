import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { loginSchema } from "@shared/schema";
import { requireAuth } from "./middleware/auth.middleware";
import { rotateCsrfToken } from "../middleware/csrf";
import { checkAccountLockout, recordFailedLogin, clearLoginAttempts } from "../lib/security";
import logger from "../lib/logger";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid input", issues: result.error.issues });
    }

    const email = result.data.email.toLowerCase().trim();
    const lockoutCheck = checkAccountLockout(email);
    if (lockoutCheck.locked) {
      logger.warn({ email }, `Login blocked: account locked for ${lockoutCheck.remainingMinutes} minutes`);
      return res.status(429).json({
        error: `Account temporarily locked due to too many failed login attempts. Please try again in ${lockoutCheck.remainingMinutes} minutes.`,
      });
    }

    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) {
      recordFailedLogin(email);
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await storage.validatePassword(user, result.data.password);
    if (!valid) {
      const lockResult = recordFailedLogin(email);
      if (lockResult.locked) {
        logger.warn({ email }, "Account locked after too many failed attempts");
        return res.status(429).json({
          error: "Account temporarily locked due to too many failed login attempts. Please try again in 15 minutes.",
        });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    clearLoginAttempts(email);
    req.session.userId = user.id;
    req.session.companyId = user.companyId;
    req.session.name = user.name ?? undefined;
    rotateCsrfToken(res);
    res.json({ user: { ...user, passwordHash: undefined } });
  } catch (error: unknown) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {});
  res.clearCookie("csrf_token", { path: "/" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await storage.getUser(req.session.userId!);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  const activeCompanyId = req.session.companyId || user.companyId;
  const company = await storage.getCompany(activeCompanyId);
  res.json({ user: { ...user, passwordHash: undefined, companyName: company?.name || null, activeCompanyId } });
});

router.post("/switch-company", requireAuth, async (req, res) => {
  try {
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ error: "companyId is required" });
    const currentUser = await storage.getUser(req.session.userId!);
    if (!currentUser || currentUser.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can switch companies" });
    }
    const targetCompany = await storage.getCompany(companyId);
    if (!targetCompany || !targetCompany.isActive) {
      return res.status(404).json({ error: "Company not found or inactive" });
    }
    req.session.companyId = companyId;
    res.json({ ok: true, companyName: targetCompany.name });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to switch company" });
  }
});

export const authRouter = router;
