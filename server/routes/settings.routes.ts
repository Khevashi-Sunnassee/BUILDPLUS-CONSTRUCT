import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole, requireSuperAdmin } from "./middleware/auth.middleware";
import { getDefaultTemplate, clearBrandingCache } from "../lib/email-template";
import { sanitizeRichHtml } from "../utils/sanitize-html";
import { db } from "../db";
import { companies } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const updateSettingsSchema = z.object({
  tz: z.string().optional(),
  captureIntervalS: z.number().int().min(60).max(3600).optional(),
  idleThresholdS: z.number().int().min(60).max(3600).optional(),
  trackedApps: z.string().optional(),
  requireAddins: z.boolean().optional(),
  weekStartDay: z.number().int().min(0).max(6).optional(),
  productionWindowDays: z.number().int().min(1).max(60).optional(),
  ifcDaysInAdvance: z.number().int().min(1).max(60).optional(),
  daysToAchieveIfc: z.number().int().min(1).max(90).optional(),
  productionDaysInAdvance: z.number().int().min(1).max(60).optional(),
  procurementDaysInAdvance: z.number().int().min(1).max(60).optional(),
  procurementTimeDays: z.number().int().min(1).max(90).optional(),
  productionWorkDays: z.array(z.boolean()).length(7).optional(),
  draftingWorkDays: z.array(z.boolean()).length(7).optional(),
  cfmeuCalendar: z.enum(["NONE", "CFMEU_QLD", "CFMEU_VIC"]).optional(),
  includePOTerms: z.boolean().optional(),
  jobNumberPrefix: z.string().max(20).optional(),
  jobNumberMinDigits: z.number().int().min(1).max(10).optional(),
  jobNumberNextSequence: z.number().int().min(1).optional(),
}).strict();

const logoSchema = z.object({
  logoBase64: z.string(),
});

const companyNameSchema = z.object({
  companyName: z.string().min(1).max(200),
});

const poTermsSchema = z.object({
  poTermsHtml: z.string(),
});

router.get("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
  try {
  const companyId = req.companyId as string;
  let settings = await storage.getGlobalSettings(companyId);
  if (!settings) {
    settings = await storage.updateGlobalSettings({
      tz: "Australia/Melbourne",
      captureIntervalS: 300,
      idleThresholdS: 300,
      trackedApps: "revit,acad",
      requireAddins: true,
    }, companyId);
  }
  res.json(settings);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.put("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const result = updateSettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const body = result.data;
    if (body.ifcDaysInAdvance !== undefined) {
      const currentSettings = await storage.getGlobalSettings(companyId);
      const effectiveProcurementDays = body.procurementDaysInAdvance ?? currentSettings?.procurementDaysInAdvance ?? 7;
      if (body.ifcDaysInAdvance <= effectiveProcurementDays) {
        return res.status(400).json({ error: `ifcDaysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
    }
    if (body.procurementDaysInAdvance !== undefined) {
      const currentSettings = await storage.getGlobalSettings(companyId);
      const effectiveIfcDays = body.ifcDaysInAdvance ?? currentSettings?.ifcDaysInAdvance ?? 14;
      if (body.procurementDaysInAdvance >= effectiveIfcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than ifcDaysInAdvance (${effectiveIfcDays})` });
      }
    }
    const settings = await storage.updateGlobalSettings(body, companyId);
    res.json(settings);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/settings/logo", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const result = logoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { logoBase64 } = result.data;
    if (logoBase64 !== "" && !logoBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format" });
    }
    const settings = await storage.updateGlobalSettings({ logoBase64: logoBase64 || null }, companyId);
    res.json({ success: true, logoBase64: settings.logoBase64 });
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

const userLogoSchema = z.object({
  logoBase64: z.string(),
});

router.post("/api/admin/settings/user-logo", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const result = userLogoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { logoBase64 } = result.data;
    if (logoBase64 !== "" && !logoBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format" });
    }
    const settings = await storage.updateGlobalSettings({ userLogoBase64: logoBase64 || null }, companyId);
    res.json({ success: true, userLogoBase64: settings.userLogoBase64 });
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/settings/company-name", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const result = companyNameSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { companyName } = result.data;
    const settings = await storage.updateGlobalSettings({ companyName }, companyId);
    res.json({ success: true, companyName: settings.companyName });
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

const companyDetailsSchema = z.object({
  abn: z.string().max(20).optional().nullable(),
  acn: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});

router.get("/api/admin/settings/company-details", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const [company] = await db.select({
      abn: companies.abn,
      acn: companies.acn,
      address: companies.address,
      phone: companies.phone,
    }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch company details" });
  }
});

router.patch("/api/admin/settings/company-details", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const parsed = companyDetailsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (parsed.data.abn !== undefined) updates.abn = parsed.data.abn?.trim() || null;
    if (parsed.data.acn !== undefined) updates.acn = parsed.data.acn?.trim() || null;
    if (parsed.data.address !== undefined) updates.address = parsed.data.address?.trim() || null;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone?.trim() || null;

    const [updated] = await db.update(companies)
      .set(updates)
      .where(eq(companies.id, companyId))
      .returning({
        abn: companies.abn,
        acn: companies.acn,
        address: companies.address,
        phone: companies.phone,
      });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update company details" });
  }
});

router.get("/api/settings/logo", async (req, res) => {
  try {
    const companyId = req.session?.userId ? req.session.companyId : undefined;
    if (!companyId) {
      return res.json({ logoBase64: null, companyName: "BuildPlus Ai" });
    }
    const settings = await storage.getGlobalSettings(companyId);
    res.json({ 
      logoBase64: settings?.logoBase64 || null,
      userLogoBase64: settings?.userLogoBase64 || null,
      companyName: settings?.companyName || "BuildPlus Ai"
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/settings/po-terms", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const settings = await storage.getGlobalSettings(companyId);
    res.json({
      poTermsHtml: settings?.poTermsHtml || "",
      includePOTerms: settings?.includePOTerms || false,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.put("/api/settings/po-terms", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const result = poTermsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { poTermsHtml } = result.data;
    const cleanHtml = sanitizeRichHtml(poTermsHtml);
    const settings = await storage.updateGlobalSettings({ poTermsHtml: cleanHtml }, companyId);
    res.json({ success: true, poTermsHtml: settings.poTermsHtml });
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.get("/api/settings/email-template", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const settings = await storage.getGlobalSettings(companyId);
    res.json({
      emailTemplateHtml: (settings as any)?.emailTemplateHtml || null,
      defaultTemplate: getDefaultTemplate(),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.put("/api/settings/email-template", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const schema = z.object({
      emailTemplateHtml: z.string().nullable(),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { emailTemplateHtml } = result.data;
    const cleanHtml = emailTemplateHtml ? sanitizeRichHtml(emailTemplateHtml) : null;
    const settings = await storage.updateGlobalSettings({ emailTemplateHtml: cleanHtml }, companyId);
    clearBrandingCache(companyId);
    res.json({ success: true, emailTemplateHtml: (settings as any).emailTemplateHtml });
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/settings/next-job-number", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const settings = await storage.getGlobalSettings(companyId);
    const prefix = settings?.jobNumberPrefix || "";
    const minDigits = settings?.jobNumberMinDigits || 3;
    const nextSeq = settings?.jobNumberNextSequence || 1;
    const paddedNum = String(nextSeq).padStart(minDigits, "0");
    const nextJobNumber = `${prefix}${paddedNum}`;
    res.json({ nextJobNumber, prefix, minDigits, nextSequence: nextSeq });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/settings/email-template/preview", requireRole("ADMIN"), async (req, res) => {
  try {
    const { buildBrandedEmail } = await import("../lib/email-template");
    const companyId = req.companyId as string;
    const preview = await buildBrandedEmail({
      title: "Sample Notification Title",
      subtitle: "Subtitle Example",
      recipientName: "John Smith",
      body: `<p>This is a preview of how your email notifications will look. All system notifications will use this consistent template format.</p>
      <p>The template includes your company branding, a greeting, and a standard footer disclaimer.</p>`,
      footerNote: "This is a sample footer note.",
      companyId,
    });
    res.json({ html: preview });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export const settingsRouter = router;
