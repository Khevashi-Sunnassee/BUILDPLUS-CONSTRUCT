import { Router } from "express";
import { storage, db } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { 
  insertWorkTypeSchema,
  jobs, productionSlots, panelRegister, draftingProgram, dailyLogs, logRows, productionEntries, 
  weeklyWageReports, weeklyJobReports, weeklyJobReportSchedules,
  loadLists, loadListPanels, purchaseOrders, purchaseOrderItems, purchaseOrderAttachments, 
  suppliers, items, itemCategories,
  conversations, conversationMembers, chatMessages, chatMessageAttachments, chatMessageReactions, 
  chatMessageMentions, chatNotifications, userChatSettings,
  tasks, taskGroups, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  productionSlotAdjustments, mappingRules, approvalEvents, productionDays, jobPanelRates,
  deliveryRecords, jobLevelCycleTimes
} from "@shared/schema";
import { sql, isNotNull } from "drizzle-orm";

const router = Router();

// Device Management Routes
router.get("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
  const devices = await storage.getAllDevices();
  res.json(devices);
});

router.post("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
  const { userId, deviceName } = req.body;
  const { device, deviceKey } = await storage.createDevice({ userId, deviceName, os: "Windows" });
  res.json({ deviceId: device.id, deviceKey });
});

router.patch("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
  const device = await storage.updateDevice(req.params.id as string, req.body);
  res.json(device);
});

router.delete("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
  await storage.deleteDevice(req.params.id as string);
  res.json({ ok: true });
});

// Work Types Routes
router.get("/api/work-types", requireAuth, async (req, res) => {
  const types = await storage.getActiveWorkTypes();
  res.json(types);
});

router.get("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  const types = await storage.getAllWorkTypes();
  res.json(types);
});

router.post("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertWorkTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
    }
    const workType = await storage.createWorkType(parsed.data);
    res.json(workType);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create work type" });
  }
});

router.put("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = insertWorkTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
    }
    const workType = await storage.updateWorkType(parseInt(req.params.id as string), parsed.data);
    if (!workType) {
      return res.status(404).json({ error: "Work type not found" });
    }
    res.json(workType);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update work type" });
  }
});

router.delete("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  await storage.deleteWorkType(parseInt(req.params.id as string));
  res.json({ ok: true });
});

// Data Deletion Routes
const dataDeletionCategories = [
  "panels",
  "production_slots",
  "drafting_program",
  "daily_logs",
  "purchase_orders",
  "logistics",
  "weekly_wages",
  "chats",
  "tasks",
  "suppliers",
  "jobs"
] as const;

type DeletionCategory = typeof dataDeletionCategories[number];

router.get("/api/admin/data-deletion/counts", requireRole("ADMIN"), async (req, res) => {
  try {
    const counts: Record<string, number> = {};
    
    const [panelCount] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister);
    counts.panels = Number(panelCount.count);
    
    const [slotCount] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots);
    counts.production_slots = Number(slotCount.count);
    
    const [draftingCount] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
    counts.drafting_program = Number(draftingCount.count);
    
    const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(dailyLogs);
    counts.daily_logs = Number(logCount.count);
    
    const [poCount] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    counts.purchase_orders = Number(poCount.count);
    
    const [loadListCount] = await db.select({ count: sql<number>`count(*)` }).from(loadLists);
    counts.logistics = Number(loadListCount.count);
    
    const [wageCount] = await db.select({ count: sql<number>`count(*)` }).from(weeklyWageReports);
    counts.weekly_wages = Number(wageCount.count);
    
    const [chatCount] = await db.select({ count: sql<number>`count(*)` }).from(conversations);
    counts.chats = Number(chatCount.count);
    
    const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks);
    counts.tasks = Number(taskCount.count);
    
    const [supplierCount] = await db.select({ count: sql<number>`count(*)` }).from(suppliers);
    counts.suppliers = Number(supplierCount.count);
    
    const [jobCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    counts.jobs = Number(jobCount.count);
    
    res.json(counts);
  } catch (error: any) {
    console.error("Error fetching data counts:", error);
    res.status(500).json({ error: error.message || "Failed to fetch data counts" });
  }
});

router.post("/api/admin/data-deletion/validate", requireRole("ADMIN"), async (req, res) => {
  try {
    const { categories } = req.body as { categories: DeletionCategory[] };
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "No categories selected" });
    }
    
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const selected = new Set(categories);
    
    if (selected.has("suppliers") && !selected.has("purchase_orders")) {
      const [poWithSupplier] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
      if (Number(poWithSupplier.count) > 0) {
        errors.push("Cannot delete Suppliers while Purchase Orders exist. Select Purchase Orders for deletion first, or delete them manually.");
      }
    }
    
    if (selected.has("jobs")) {
      if (!selected.has("panels")) {
        const [panelWithJob] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister);
        if (Number(panelWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Panels exist. Select Panels for deletion first.");
        }
      }
      if (!selected.has("production_slots")) {
        const [slotWithJob] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots);
        if (Number(slotWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Production Slots exist. Select Production Slots for deletion first.");
        }
      }
      if (!selected.has("drafting_program")) {
        const [draftingWithJob] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
        if (Number(draftingWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Drafting Program entries exist. Select Drafting Program for deletion first.");
        }
      }
      if (!selected.has("logistics")) {
        const [loadListWithJob] = await db.select({ count: sql<number>`count(*)` }).from(loadLists);
        if (Number(loadListWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Load Lists exist. Select Logistics for deletion first.");
        }
      }
      if (!selected.has("daily_logs")) {
        const [logsWithJob] = await db.select({ count: sql<number>`count(*)` })
          .from(logRows)
          .where(isNotNull(logRows.jobId));
        if (Number(logsWithJob.count) > 0) {
          warnings.push("Some Daily Logs reference Jobs. Job references in logs will be cleared.");
        }
      }
      const [weeklyJobReportCount] = await db.select({ count: sql<number>`count(*)` }).from(weeklyJobReports);
      if (Number(weeklyJobReportCount.count) > 0) {
        warnings.push(`${weeklyJobReportCount.count} Weekly Job Reports will also be deleted with Jobs.`);
      }
    }
    
    if (selected.has("panels")) {
      if (!selected.has("drafting_program")) {
        const [draftingWithPanel] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram);
        if (Number(draftingWithPanel.count) > 0) {
          errors.push("Cannot delete Panels while Drafting Program entries exist. Select Drafting Program for deletion first.");
        }
      }
      if (!selected.has("logistics")) {
        const [loadPanels] = await db.select({ count: sql<number>`count(*)` }).from(loadListPanels);
        if (Number(loadPanels.count) > 0) {
          errors.push("Cannot delete Panels while Load Lists contain panels. Select Logistics for deletion first.");
        }
      }
      const [prodEntries] = await db.select({ count: sql<number>`count(*)` }).from(productionEntries);
      if (Number(prodEntries.count) > 0) {
        warnings.push(`${prodEntries.count} Production Entries will also be deleted with Panels.`);
      }
    }
    
    if (selected.has("production_slots") && !selected.has("drafting_program")) {
      const [draftingWithSlot] = await db.select({ count: sql<number>`count(*)` })
        .from(draftingProgram)
        .where(isNotNull(draftingProgram.productionSlotId));
      if (Number(draftingWithSlot.count) > 0) {
        warnings.push("Production slot references in Drafting Program will be cleared.");
      }
    }
    
    if (selected.has("tasks")) {
      const [taskGroupCount] = await db.select({ count: sql<number>`count(*)` }).from(taskGroups);
      if (Number(taskGroupCount.count) > 0) {
        warnings.push("Task Groups will also be deleted along with Tasks.");
      }
    }
    
    res.json({ 
      valid: errors.length === 0,
      errors,
      warnings
    });
  } catch (error: any) {
    console.error("Error validating deletion:", error);
    res.status(500).json({ error: error.message || "Failed to validate deletion" });
  }
});

router.post("/api/admin/data-deletion/delete", requireRole("ADMIN"), async (req, res) => {
  try {
    const { categories } = req.body as { categories: DeletionCategory[] };
    
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: "No categories selected" });
    }
    
    const selected = new Set(categories);
    const deletedCounts: Record<string, number> = {};
    
    if (selected.has("drafting_program")) {
      const result = await db.delete(draftingProgram);
      deletedCounts.drafting_program = result.rowCount || 0;
    }
    
    if (selected.has("logistics")) {
      await db.delete(deliveryRecords);
      await db.delete(loadListPanels);
      const result = await db.delete(loadLists);
      deletedCounts.logistics = result.rowCount || 0;
    }
    
    if (selected.has("daily_logs")) {
      await db.delete(approvalEvents);
      await db.delete(logRows);
      const result = await db.delete(dailyLogs);
      deletedCounts.daily_logs = result.rowCount || 0;
    }
    
    if (selected.has("weekly_wages")) {
      const result = await db.delete(weeklyWageReports);
      deletedCounts.weekly_wages = result.rowCount || 0;
    }
    
    if (selected.has("purchase_orders")) {
      await db.delete(purchaseOrderAttachments);
      await db.delete(purchaseOrderItems);
      const result = await db.delete(purchaseOrders);
      deletedCounts.purchase_orders = result.rowCount || 0;
    }
    
    if (selected.has("chats")) {
      await db.delete(chatNotifications);
      await db.delete(chatMessageMentions);
      await db.delete(chatMessageReactions);
      await db.delete(chatMessageAttachments);
      await db.delete(chatMessages);
      await db.delete(conversationMembers);
      const result = await db.delete(conversations);
      deletedCounts.chats = result.rowCount || 0;
      await db.delete(userChatSettings);
    }
    
    if (selected.has("tasks")) {
      await db.delete(taskNotifications);
      await db.delete(taskFiles);
      await db.delete(taskUpdates);
      await db.delete(taskAssignees);
      await db.delete(tasks);
      const result = await db.delete(taskGroups);
      deletedCounts.tasks = result.rowCount || 0;
    }
    
    if (selected.has("panels")) {
      await db.update(conversations).set({ panelId: null }).where(isNotNull(conversations.panelId));
      await db.update(logRows).set({ panelRegisterId: null }).where(isNotNull(logRows.panelRegisterId));
      await db.delete(productionEntries);
      const result = await db.delete(panelRegister);
      deletedCounts.panels = result.rowCount || 0;
    }
    
    if (selected.has("production_slots")) {
      await db.update(draftingProgram).set({ productionSlotId: null }).where(isNotNull(draftingProgram.productionSlotId));
      await db.delete(productionSlotAdjustments);
      const result = await db.delete(productionSlots);
      deletedCounts.production_slots = result.rowCount || 0;
    }
    
    if (selected.has("suppliers")) {
      await db.delete(items);
      await db.delete(itemCategories);
      const result = await db.delete(suppliers);
      deletedCounts.suppliers = result.rowCount || 0;
    }
    
    if (selected.has("jobs")) {
      await db.update(conversations).set({ jobId: null }).where(isNotNull(conversations.jobId));
      await db.update(logRows).set({ jobId: null }).where(isNotNull(logRows.jobId));
      await db.delete(weeklyJobReportSchedules);
      await db.delete(weeklyJobReports);
      await db.delete(productionDays);
      await db.delete(jobPanelRates);
      await db.delete(mappingRules);
      await db.delete(jobLevelCycleTimes);
      const result = await db.delete(jobs);
      deletedCounts.jobs = result.rowCount || 0;
    }
    
    res.json({ 
      success: true,
      deleted: deletedCounts
    });
  } catch (error: any) {
    console.error("Error performing deletion:", error);
    res.status(500).json({ error: error.message || "Failed to delete data" });
  }
});

export const adminRouter = router;
