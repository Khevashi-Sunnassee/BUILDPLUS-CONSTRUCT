import { Router } from "express";
import { storage, db } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { 
  insertWorkTypeSchema, insertDeviceSchema,
  jobs, productionSlots, panelRegister, draftingProgram, dailyLogs, logRows, productionEntries, 
  weeklyWageReports, weeklyJobReports, weeklyJobReportSchedules,
  loadLists, loadListPanels, purchaseOrders, purchaseOrderItems, purchaseOrderAttachments, 
  suppliers, items, itemCategories,
  conversations, conversationMembers, chatMessages, chatMessageAttachments, chatMessageReactions, 
  chatMessageMentions, chatNotifications, userChatSettings,
  tasks, taskGroups, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  productionSlotAdjustments, mappingRules, approvalEvents, productionDays, jobPanelRates,
  deliveryRecords, jobLevelCycleTimes,
  assets, assetMaintenanceRecords, assetTransfers,
  documents, documentBundleItems,
  contracts,
  progressClaims, progressClaimItems,
  broadcastTemplates, broadcastMessages,
  activityTemplates, activityTemplateSubtasks,
  jobActivities, jobActivityAssignees, jobActivityUpdates, jobActivityFiles,
} from "@shared/schema";
import { sql, isNotNull } from "drizzle-orm";
import logger from "../lib/logger";

const router = Router();

// Device Management Routes
router.get("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const allDevices = await storage.getAllDevices();
  const filtered = allDevices.filter(d => d.companyId === companyId);
  res.json(filtered);
});

router.post("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
  const { userId, deviceName } = req.body;
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const { device, deviceKey } = await storage.createDevice({ userId, deviceName, os: "Windows", companyId });
  res.json({ deviceId: device.id, deviceKey });
});

router.patch("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  const existing = await storage.getDevice(req.params.id as string);
  if (!existing || existing.companyId !== companyId) {
    return res.status(404).json({ error: "Device not found" });
  }
  const parsed = insertDeviceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const device = await storage.updateDevice(req.params.id as string, parsed.data as any);
  res.json(device);
});

router.delete("/api/admin/devices/:id", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  const existing = await storage.getDevice(req.params.id as string);
  if (!existing || existing.companyId !== companyId) {
    return res.status(404).json({ error: "Device not found" });
  }
  await storage.deleteDevice(req.params.id as string);
  res.json({ ok: true });
});

// Work Types Routes
router.get("/api/work-types", requireAuth, async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const types = await storage.getActiveWorkTypes(companyId);
  res.json(types);
});

router.get("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const types = await storage.getAllWorkTypes(companyId);
  res.json(types);
});

router.post("/api/admin/work-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = insertWorkTypeSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
    }
    const workType = await storage.createWorkType(parsed.data);
    res.json(workType);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create work type" });
  }
});

router.put("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const existing = await storage.getWorkType(parseInt(req.params.id as string));
    if (!existing || existing.companyId !== companyId) {
      return res.status(404).json({ error: "Work type not found" });
    }
    const parsed = insertWorkTypeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid work type data", issues: parsed.error.issues });
    }
    const workType = await storage.updateWorkType(parseInt(req.params.id as string), parsed.data);
    if (!workType) {
      return res.status(404).json({ error: "Work type not found" });
    }
    res.json(workType);
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update work type" });
  }
});

router.delete("/api/admin/work-types/:id", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const existing = await storage.getWorkType(parseInt(req.params.id as string));
  if (!existing || existing.companyId !== companyId) {
    return res.status(404).json({ error: "Work type not found" });
  }
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
  "jobs",
  "assets",
  "documents",
  "contracts",
  "progress_claims",
  "broadcast_templates",
  "activity_templates",
  "job_activities",
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
    
    const [assetCount] = await db.select({ count: sql<number>`count(*)` }).from(assets);
    counts.assets = Number(assetCount.count);
    
    const [documentCount] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    counts.documents = Number(documentCount.count);
    
    const [contractCount] = await db.select({ count: sql<number>`count(*)` }).from(contracts);
    counts.contracts = Number(contractCount.count);
    
    const [progressClaimCount] = await db.select({ count: sql<number>`count(*)` }).from(progressClaims);
    counts.progress_claims = Number(progressClaimCount.count);
    
    const [broadcastTemplateCount] = await db.select({ count: sql<number>`count(*)` }).from(broadcastTemplates);
    counts.broadcast_templates = Number(broadcastTemplateCount.count);
    
    const [activityTemplateCount] = await db.select({ count: sql<number>`count(*)` }).from(activityTemplates);
    counts.activity_templates = Number(activityTemplateCount.count);
    
    const [jobActivityCount] = await db.select({ count: sql<number>`count(*)` }).from(jobActivities);
    counts.job_activities = Number(jobActivityCount.count);
    
    res.json(counts);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching data counts");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch data counts" });
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
    
    if (selected.has("assets")) {
      const [maintenanceCount] = await db.select({ count: sql<number>`count(*)` }).from(assetMaintenanceRecords);
      const [transferCount] = await db.select({ count: sql<number>`count(*)` }).from(assetTransfers);
      const totalRelated = Number(maintenanceCount.count) + Number(transferCount.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} asset maintenance records and transfers will also be deleted.`);
      }
    }
    
    if (selected.has("documents")) {
      const [contractDocRef] = await db.select({ count: sql<number>`count(*)` }).from(contracts).where(isNotNull(contracts.aiSourceDocumentId));
      if (Number(contractDocRef.count) > 0 && !selected.has("contracts")) {
        errors.push("Cannot delete Documents while Contracts reference them. Select Contracts for deletion first, or unlink them.");
      }
      const [bundleItemCount] = await db.select({ count: sql<number>`count(*)` }).from(documentBundleItems);
      if (Number(bundleItemCount.count) > 0) {
        warnings.push(`${bundleItemCount.count} document bundle link(s) will also be deleted.`);
      }
    }
    
    if (selected.has("contracts")) {
      warnings.push("All contract records will be permanently deleted.");
    }
    
    if (selected.has("progress_claims")) {
      const [claimItemCount] = await db.select({ count: sql<number>`count(*)` }).from(progressClaimItems);
      if (Number(claimItemCount.count) > 0) {
        warnings.push(`${claimItemCount.count} progress claim line item(s) will also be deleted.`);
      }
    }
    
    if (selected.has("broadcast_templates")) {
      const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(broadcastMessages);
      if (Number(msgCount.count) > 0) {
        warnings.push(`${msgCount.count} broadcast message(s) will also be deleted with templates.`);
      }
    }
    
    if (selected.has("activity_templates")) {
      const [subtaskCount] = await db.select({ count: sql<number>`count(*)` }).from(activityTemplateSubtasks);
      if (Number(subtaskCount.count) > 0) {
        warnings.push(`${subtaskCount.count} activity template subtask(s) will also be deleted.`);
      }
    }
    
    if (selected.has("job_activities")) {
      const [assigneeCount] = await db.select({ count: sql<number>`count(*)` }).from(jobActivityAssignees);
      const [updateCount] = await db.select({ count: sql<number>`count(*)` }).from(jobActivityUpdates);
      const [fileCount] = await db.select({ count: sql<number>`count(*)` }).from(jobActivityFiles);
      const totalRelated = Number(assigneeCount.count) + Number(updateCount.count) + Number(fileCount.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} activity assignee(s), update(s), and file(s) will also be deleted.`);
      }
    }
    
    res.json({ 
      valid: errors.length === 0,
      errors,
      warnings
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error validating deletion");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to validate deletion" });
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
    
    if (selected.has("assets")) {
      await db.delete(assetMaintenanceRecords);
      await db.delete(assetTransfers);
      const result = await db.delete(assets);
      deletedCounts.assets = result.rowCount || 0;
    }
    
    if (selected.has("contracts")) {
      const result = await db.delete(contracts);
      deletedCounts.contracts = result.rowCount || 0;
    }
    
    if (selected.has("documents")) {
      if (!selected.has("contracts")) {
        const [contractDocRef] = await db.select({ count: sql<number>`count(*)` }).from(contracts).where(isNotNull(contracts.aiSourceDocumentId));
        if (Number(contractDocRef.count) > 0) {
          return res.status(400).json({ error: "Cannot delete Documents while Contracts reference them. Select Contracts for deletion first." });
        }
      }
      await db.delete(documentBundleItems);
      const result = await db.delete(documents);
      deletedCounts.documents = result.rowCount || 0;
    }
    
    if (selected.has("progress_claims")) {
      await db.delete(progressClaimItems);
      const result = await db.delete(progressClaims);
      deletedCounts.progress_claims = result.rowCount || 0;
    }
    
    if (selected.has("broadcast_templates")) {
      await db.delete(broadcastMessages);
      const result = await db.delete(broadcastTemplates);
      deletedCounts.broadcast_templates = result.rowCount || 0;
    }
    
    if (selected.has("job_activities")) {
      await db.delete(jobActivityFiles);
      await db.delete(jobActivityUpdates);
      await db.delete(jobActivityAssignees);
      await db.update(tasks).set({ jobActivityId: null }).where(isNotNull(tasks.jobActivityId));
      const result = await db.delete(jobActivities);
      deletedCounts.job_activities = result.rowCount || 0;
    }
    
    if (selected.has("activity_templates")) {
      await db.delete(activityTemplateSubtasks);
      const result = await db.delete(activityTemplates);
      deletedCounts.activity_templates = result.rowCount || 0;
    }
    
    res.json({ 
      success: true,
      deleted: deletedCounts
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error performing deletion");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete data" });
  }
});

export const adminRouter = router;
