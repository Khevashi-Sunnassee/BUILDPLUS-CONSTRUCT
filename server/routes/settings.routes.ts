import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";

const router = Router();

router.get("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
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
});

router.put("/api/admin/settings", requireRole("ADMIN"), async (req, res) => {
  if (req.body.weekStartDay !== undefined) {
    const weekStartDay = parseInt(req.body.weekStartDay, 10);
    if (isNaN(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
      return res.status(400).json({ error: "weekStartDay must be a number between 0 (Sunday) and 6 (Saturday)" });
    }
    req.body.weekStartDay = weekStartDay;
  }
  if (req.body.productionWindowDays !== undefined) {
    const productionWindowDays = parseInt(req.body.productionWindowDays, 10);
    if (isNaN(productionWindowDays) || productionWindowDays < 1 || productionWindowDays > 60) {
      return res.status(400).json({ error: "productionWindowDays must be a number between 1 and 60" });
    }
    req.body.productionWindowDays = productionWindowDays;
  }
  if (req.body.ifcDaysInAdvance !== undefined) {
    const ifcDaysInAdvance = parseInt(req.body.ifcDaysInAdvance, 10);
    if (isNaN(ifcDaysInAdvance) || ifcDaysInAdvance < 1 || ifcDaysInAdvance > 60) {
      return res.status(400).json({ error: "ifcDaysInAdvance must be a number between 1 and 60" });
    }
    const currentSettings = await storage.getGlobalSettings();
    const effectiveProcurementDays = req.body.procurementDaysInAdvance ?? currentSettings?.procurementDaysInAdvance ?? 7;
    if (ifcDaysInAdvance <= effectiveProcurementDays) {
      return res.status(400).json({ error: `ifcDaysInAdvance must be greater than procurementDaysInAdvance (${effectiveProcurementDays})` });
    }
    req.body.ifcDaysInAdvance = ifcDaysInAdvance;
  }
  if (req.body.daysToAchieveIfc !== undefined) {
    const daysToAchieveIfc = parseInt(req.body.daysToAchieveIfc, 10);
    if (isNaN(daysToAchieveIfc) || daysToAchieveIfc < 1 || daysToAchieveIfc > 90) {
      return res.status(400).json({ error: "daysToAchieveIfc must be a number between 1 and 90" });
    }
    req.body.daysToAchieveIfc = daysToAchieveIfc;
  }
  if (req.body.productionDaysInAdvance !== undefined) {
    const productionDaysInAdvance = parseInt(req.body.productionDaysInAdvance, 10);
    if (isNaN(productionDaysInAdvance) || productionDaysInAdvance < 1 || productionDaysInAdvance > 60) {
      return res.status(400).json({ error: "productionDaysInAdvance must be a number between 1 and 60" });
    }
    req.body.productionDaysInAdvance = productionDaysInAdvance;
  }
  if (req.body.procurementDaysInAdvance !== undefined) {
    const procurementDaysInAdvance = parseInt(req.body.procurementDaysInAdvance, 10);
    if (isNaN(procurementDaysInAdvance) || procurementDaysInAdvance < 1 || procurementDaysInAdvance > 60) {
      return res.status(400).json({ error: "procurementDaysInAdvance must be a number between 1 and 60" });
    }
    const currentSettings = await storage.getGlobalSettings();
    const effectiveIfcDays = req.body.ifcDaysInAdvance ?? currentSettings?.ifcDaysInAdvance ?? 14;
    if (procurementDaysInAdvance >= effectiveIfcDays) {
      return res.status(400).json({ error: `procurementDaysInAdvance must be less than ifcDaysInAdvance (${effectiveIfcDays})` });
    }
    req.body.procurementDaysInAdvance = procurementDaysInAdvance;
  }
  if (req.body.procurementTimeDays !== undefined) {
    const procurementTimeDays = parseInt(req.body.procurementTimeDays, 10);
    if (isNaN(procurementTimeDays) || procurementTimeDays < 1 || procurementTimeDays > 90) {
      return res.status(400).json({ error: "procurementTimeDays must be a number between 1 and 90" });
    }
    req.body.procurementTimeDays = procurementTimeDays;
  }
  const settings = await storage.updateGlobalSettings(req.body);
  res.json(settings);
});

router.post("/api/admin/settings/logo", requireRole("ADMIN"), async (req, res) => {
  try {
    const { logoBase64 } = req.body;
    if (typeof logoBase64 !== "string") {
      return res.status(400).json({ error: "Logo data is required" });
    }
    if (logoBase64 !== "" && !logoBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image format" });
    }
    const settings = await storage.updateGlobalSettings({ logoBase64: logoBase64 || null });
    res.json({ success: true, logoBase64: settings.logoBase64 });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to upload logo" });
  }
});

router.post("/api/admin/settings/company-name", requireRole("ADMIN"), async (req, res) => {
  try {
    const { companyName } = req.body;
    if (!companyName || typeof companyName !== "string") {
      return res.status(400).json({ error: "Company name is required" });
    }
    const settings = await storage.updateGlobalSettings({ companyName });
    res.json({ success: true, companyName: settings.companyName });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save company name" });
  }
});

router.get("/api/settings/logo", async (req, res) => {
  const settings = await storage.getGlobalSettings();
  res.json({ 
    logoBase64: settings?.logoBase64 || null,
    companyName: settings?.companyName || "LTE Precast Concrete Structures"
  });
});

export const settingsRouter = router;
