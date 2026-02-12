import { Router } from "express";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";

const router = Router();

// Validation schemas
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
  let settings = await storage.getGlobalSettings();
  if (!settings) {
    settings = await storage.updateGlobalSettings({
      tz: "Australia/Melbourne",
      captureIntervalS: 300,
      idleThresholdS: 300,
      trackedApps: "revit,acad",
      requireAddins: true,
    });
  }
  res.json(settings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load settings" });
  }
});

router.put("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = updateSettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const body = result.data;
    if (body.ifcDaysInAdvance !== undefined) {
      const currentSettings = await storage.getGlobalSettings();
      const effectiveProcurementDays = body.procurementDaysInAdvance ?? currentSettings?.procurementDaysInAdvance ?? 7;
      if (body.ifcDaysInAdvance <= effectiveProcurementDays) {
        return res.status(400).json({ error: `ifcDaysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
      }
    }
    if (body.procurementDaysInAdvance !== undefined) {
      const currentSettings = await storage.getGlobalSettings();
      const effectiveIfcDays = body.ifcDaysInAdvance ?? currentSettings?.ifcDaysInAdvance ?? 14;
      if (body.procurementDaysInAdvance >= effectiveIfcDays) {
        return res.status(400).json({ error: `procurementDaysInAdvance must be less than ifcDaysInAdvance (${effectiveIfcDays})` });
      }
    }
    const settings = await storage.updateGlobalSettings(body);
    res.json(settings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update settings" });
  }
});

router.post("/api/admin/settings/logo", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = logoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { logoBase64 } = result.data;
    if (logoBase64 !== "" && !logoBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format" });
    }
    const settings = await storage.updateGlobalSettings({ logoBase64: logoBase64 || null });
    res.json({ success: true, logoBase64: settings.logoBase64 });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to upload logo" });
  }
});

router.post("/api/admin/settings/company-name", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = companyNameSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { companyName } = result.data;
    const settings = await storage.updateGlobalSettings({ companyName });
    res.json({ success: true, companyName: settings.companyName });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save company name" });
  }
});

router.get("/api/settings/logo", async (req, res) => {
  try {
    const settings = await storage.getGlobalSettings();
    res.json({ 
      logoBase64: settings?.logoBase64 || null,
      companyName: settings?.companyName || "BuildPlus Ai"
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load logo" });
  }
});

router.get("/api/settings/po-terms", requireAuth, async (req, res) => {
  try {
    const settings = await storage.getGlobalSettings();
    res.json({
      poTermsHtml: settings?.poTermsHtml || "",
      includePOTerms: settings?.includePOTerms || false,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load PO terms" });
  }
});

router.put("/api/settings/po-terms", requireRole("ADMIN"), async (req, res) => {
  try {
    const result = poTermsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { poTermsHtml } = result.data;
    const cleanHtml = sanitizeHtml(poTermsHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "u", "s", "span", "div"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        span: ["style"],
        div: ["style"],
        p: ["style"],
      },
      allowedStyles: {
        "*": {
          "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
          "text-decoration": [/^underline$/, /^line-through$/],
          "font-weight": [/^bold$/, /^normal$/, /^\d+$/],
          "font-style": [/^italic$/, /^normal$/],
        },
      },
    });
    const settings = await storage.updateGlobalSettings({ poTermsHtml: cleanHtml });
    res.json({ success: true, poTermsHtml: settings.poTermsHtml });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save PO terms" });
  }
});

export const settingsRouter = router;
