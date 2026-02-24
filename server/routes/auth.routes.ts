import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { storage } from "../storage";
import { db } from "../db";
import { loginSchema, passwordResetTokens, users } from "@shared/schema";
import { requireAuth, requireRoleOrSuperAdmin } from "./middleware/auth.middleware";
import { rotateCsrfToken } from "../middleware/csrf";
import { checkAccountLockout, recordFailedLogin, clearLoginAttempts, strongPasswordSchema } from "../lib/security";
import { buildBrandedEmail } from "../lib/email-template";
import { emailDispatchService } from "../services/email-dispatch.service";
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
    const userData = { ...user, passwordHash: undefined };
    req.session.regenerate((err) => {
      if (err) {
        logger.error({ err }, "Session regeneration failed");
        return res.status(500).json({ error: "Internal server error" });
      }
      req.session.userId = user.id;
      req.session.companyId = user.companyId;
      req.session.name = user.name ?? undefined;
      rotateCsrfToken(res);
      res.json({ user: userData });
    });
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
    if (!currentUser || (currentUser.role !== "ADMIN" && !currentUser.isSuperAdmin)) {
      return res.status(403).json({ error: "Only admins can switch companies" });
    }
    const targetCompany = await storage.getCompany(companyId);
    if (!targetCompany || !targetCompany.isActive) {
      return res.status(404).json({ error: "Company not found or inactive" });
    }
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Session regeneration failed" });
      }
      req.session.userId = currentUser!.id;
      req.session.companyId = companyId;
      req.session.name = currentUser!.name ?? undefined;
      rotateCsrfToken(res);
      res.json({ ok: true, companyName: targetCompany.name });
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "Failed to switch company" });
  }
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/admin-reset-password", requireAuth, requireRoleOrSuperAdmin("ADMIN"), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const targetUser = await storage.getUser(userId);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    if (targetUser.companyId !== req.companyId) return res.status(403).json({ error: "Cannot reset password for users in other companies" });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.insert(passwordResetTokens).values({
      userId: targetUser.id,
      companyId: targetUser.companyId,
      tokenHash,
      expiresAt,
      createdBy: req.session.userId!,
    });

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["host"];
    const resetUrl = `${protocol}://${host}/reset-password/${token}`;

    const company = await storage.getCompany(targetUser.companyId);
    const emailHtml = await buildBrandedEmail({
      title: "Password Reset Request",
      recipientName: targetUser.name || targetUser.email,
      companyId: targetUser.companyId,
      body: `
        <p style="margin: 0 0 16px 0;">An administrator has initiated a password reset for your account.</p>
        <p style="margin: 0 0 24px 0;">Click the button below to set a new password. This link will expire in 24 hours.</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 14px;">Reset Password</a>
        </div>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b;">If you did not expect this, please contact your administrator.</p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">Or copy this link: ${resetUrl}</p>
      `,
      footerNote: "This link expires in 24 hours and can only be used once.",
    });

    await emailDispatchService.enqueueDirectEmail({
      companyId: targetUser.companyId,
      to: targetUser.email,
      subject: `Password Reset - ${company?.name || "BuildPlus"}`,
      htmlBody: emailHtml,
      userId: req.session.userId!,
    });

    logger.info({ userId: targetUser.id, email: targetUser.email, initiatedBy: req.session.userId }, "Password reset email sent");
    res.json({ ok: true, message: "Password reset email sent" });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to initiate password reset");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/reset-password/:token/validate", async (req, res) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const [resetToken] = await db.select({
      id: passwordResetTokens.id,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      email: users.email,
      companyId: passwordResetTokens.companyId,
    })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!resetToken) {
      return res.status(404).json({ valid: false, error: "Invalid or expired reset link" });
    }
    if (resetToken.usedAt) {
      return res.status(400).json({ valid: false, error: "This reset link has already been used" });
    }
    if (new Date() > resetToken.expiresAt) {
      return res.status(400).json({ valid: false, error: "This reset link has expired" });
    }

    const company = await storage.getCompany(resetToken.companyId);
    res.json({ valid: true, email: resetToken.email, companyName: company?.name || "" });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to validate reset token");
    res.status(500).json({ valid: false, error: "An internal error occurred" });
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

router.post("/reset-password", async (req, res) => {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { token, password } = parseResult.data;
    const tokenHash = hashToken(token);

    const [resetToken] = await db.select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        )
      )
      .limit(1);

    if (!resetToken) {
      return res.status(400).json({ error: "Invalid, expired, or already used reset link" });
    }

    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    await storage.updateUser(resetToken.userId, { password });

    logger.info({ userId: resetToken.userId }, "Password reset completed successfully");
    res.json({ ok: true, message: "Password has been reset successfully" });
  } catch (error: any) {
    logger.error({ error: error.message }, "Failed to reset password");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export const authRouter = router;
