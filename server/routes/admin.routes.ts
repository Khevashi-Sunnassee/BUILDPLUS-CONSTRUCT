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
  costCodes, childCostCodes, costCodeDefaults, jobCostCodes,
  tenders, tenderPackages, tenderSubmissions, tenderLineItems, tenderLineActivities, tenderLineFiles, tenderLineRisks,
  jobBudgets, budgetLines, budgetLineFiles,
  boqGroups, boqItems,
} from "@shared/schema";
import { sql, isNotNull, eq, and, inArray } from "drizzle-orm";
import logger from "../lib/logger";

const router = Router();

// Device Management Routes
router.get("/api/admin/devices", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) return res.status(400).json({ error: "Company context required" });
  const filtered = await storage.getAllDevices(companyId);
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
  const device = await storage.updateDevice(req.params.id as string, parsed.data as Record<string, unknown>);
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
  "cost_codes",
  "tenders",
  "budgets",
  "boq",
] as const;

type DeletionCategory = typeof dataDeletionCategories[number];

router.get("/api/admin/data-deletion/counts", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const counts: Record<string, number> = {};
    
    const [panelCount] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister).where(eq(panelRegister.companyId, companyId));
    counts.panels = Number(panelCount.count);
    
    const [slotCount] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots).where(eq(productionSlots.companyId, companyId));
    counts.production_slots = Number(slotCount.count);
    
    const [draftingCount] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram).where(eq(draftingProgram.companyId, companyId));
    counts.drafting_program = Number(draftingCount.count);
    
    const [logCount] = await db.select({ count: sql<number>`count(*)` }).from(dailyLogs).where(eq(dailyLogs.companyId, companyId));
    counts.daily_logs = Number(logCount.count);
    
    const [poCount] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.companyId, companyId));
    counts.purchase_orders = Number(poCount.count);
    
    const [loadListCount] = await db.select({ count: sql<number>`count(*)` }).from(loadLists).where(eq(loadLists.companyId, companyId));
    counts.logistics = Number(loadListCount.count);
    
    const [wageCount] = await db.select({ count: sql<number>`count(*)` }).from(weeklyWageReports).where(eq(weeklyWageReports.companyId, companyId));
    counts.weekly_wages = Number(wageCount.count);
    
    const [chatCount] = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(eq(conversations.companyId, companyId));
    counts.chats = Number(chatCount.count);
    
    const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.companyId, companyId));
    counts.tasks = Number(taskCount.count);
    
    const [supplierCount] = await db.select({ count: sql<number>`count(*)` }).from(suppliers).where(eq(suppliers.companyId, companyId));
    counts.suppliers = Number(supplierCount.count);
    
    const [jobCount] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.companyId, companyId));
    counts.jobs = Number(jobCount.count);
    
    const [assetCount] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.companyId, companyId));
    counts.assets = Number(assetCount.count);
    
    const [documentCount] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(eq(documents.companyId, companyId));
    counts.documents = Number(documentCount.count);
    
    const [contractCount] = await db.select({ count: sql<number>`count(*)` }).from(contracts).where(eq(contracts.companyId, companyId));
    counts.contracts = Number(contractCount.count);
    
    const [progressClaimCount] = await db.select({ count: sql<number>`count(*)` }).from(progressClaims).where(eq(progressClaims.companyId, companyId));
    counts.progress_claims = Number(progressClaimCount.count);
    
    const [broadcastTemplateCount] = await db.select({ count: sql<number>`count(*)` }).from(broadcastTemplates).where(eq(broadcastTemplates.companyId, companyId));
    counts.broadcast_templates = Number(broadcastTemplateCount.count);
    
    const [activityTemplateCount] = await db.select({ count: sql<number>`count(*)` }).from(activityTemplates).where(eq(activityTemplates.companyId, companyId));
    counts.activity_templates = Number(activityTemplateCount.count);
    
    const [jobActivityCount] = await db.select({ count: sql<number>`count(*)` }).from(jobActivities).where(eq(jobActivities.companyId, companyId));
    counts.job_activities = Number(jobActivityCount.count);
    
    const [costCodeCount] = await db.select({ count: sql<number>`count(*)` }).from(costCodes).where(eq(costCodes.companyId, companyId));
    counts.cost_codes = Number(costCodeCount.count);
    
    const [tenderCount] = await db.select({ count: sql<number>`count(*)` }).from(tenders).where(eq(tenders.companyId, companyId));
    counts.tenders = Number(tenderCount.count);
    
    const [budgetCount] = await db.select({ count: sql<number>`count(*)` }).from(jobBudgets).where(eq(jobBudgets.companyId, companyId));
    counts.budgets = Number(budgetCount.count);
    
    const [boqGroupCount] = await db.select({ count: sql<number>`count(*)` }).from(boqGroups).where(eq(boqGroups.companyId, companyId));
    const [boqItemCount] = await db.select({ count: sql<number>`count(*)` }).from(boqItems).where(eq(boqItems.companyId, companyId));
    counts.boq = Number(boqGroupCount.count) + Number(boqItemCount.count);
    
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
    
    const cid = req.companyId;
    if (!cid) return res.status(400).json({ error: "Company context required" });
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const selected = new Set(categories);
    
    if (selected.has("suppliers") && !selected.has("purchase_orders")) {
      const [poWithSupplier] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.companyId, cid));
      if (Number(poWithSupplier.count) > 0) {
        errors.push("Cannot delete Suppliers while Purchase Orders exist. Select Purchase Orders for deletion first, or delete them manually.");
      }
    }
    
    if (selected.has("jobs")) {
      if (!selected.has("panels")) {
        const [panelWithJob] = await db.select({ count: sql<number>`count(*)` }).from(panelRegister).where(eq(panelRegister.companyId, cid));
        if (Number(panelWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Panels exist. Select Panels for deletion first.");
        }
      }
      if (!selected.has("production_slots")) {
        const [slotWithJob] = await db.select({ count: sql<number>`count(*)` }).from(productionSlots).where(eq(productionSlots.companyId, cid));
        if (Number(slotWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Production Slots exist. Select Production Slots for deletion first.");
        }
      }
      if (!selected.has("drafting_program")) {
        const [draftingWithJob] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram).where(eq(draftingProgram.companyId, cid));
        if (Number(draftingWithJob.count) > 0) {
          errors.push("Cannot delete Jobs while Drafting Program entries exist. Select Drafting Program for deletion first.");
        }
      }
      if (!selected.has("logistics")) {
        const [loadListWithJob] = await db.select({ count: sql<number>`count(*)` }).from(loadLists).where(eq(loadLists.companyId, cid));
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
        const [draftingWithPanel] = await db.select({ count: sql<number>`count(*)` }).from(draftingProgram).where(eq(draftingProgram.companyId, cid));
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
        .where(and(eq(draftingProgram.companyId, cid), isNotNull(draftingProgram.productionSlotId)));
      if (Number(draftingWithSlot.count) > 0) {
        warnings.push("Production slot references in Drafting Program will be cleared.");
      }
    }
    
    if (selected.has("tasks")) {
      const [taskGroupCount] = await db.select({ count: sql<number>`count(*)` }).from(taskGroups).where(eq(taskGroups.companyId, cid));
      if (Number(taskGroupCount.count) > 0) {
        warnings.push("Task Groups will also be deleted along with Tasks.");
      }
    }
    
    if (selected.has("assets")) {
      const [maintenanceCount] = await db.select({ count: sql<number>`count(*)` }).from(assetMaintenanceRecords).where(eq(assetMaintenanceRecords.companyId, cid));
      const [transferCount] = await db.select({ count: sql<number>`count(*)` }).from(assetTransfers).where(eq(assetTransfers.companyId, cid));
      const totalRelated = Number(maintenanceCount.count) + Number(transferCount.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} asset maintenance records and transfers will also be deleted.`);
      }
    }
    
    if (selected.has("documents")) {
      const [contractDocRef] = await db.select({ count: sql<number>`count(*)` }).from(contracts).where(and(eq(contracts.companyId, cid), isNotNull(contracts.aiSourceDocumentId)));
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
      const [msgCount] = await db.select({ count: sql<number>`count(*)` }).from(broadcastMessages).where(eq(broadcastMessages.companyId, cid));
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
    
    if (selected.has("cost_codes")) {
      if (!selected.has("budgets")) {
        const [budgetLineRef] = await db.select({ count: sql<number>`count(*)` }).from(budgetLines).where(eq(budgetLines.companyId, cid));
        if (Number(budgetLineRef.count) > 0) {
          errors.push("Cannot delete Cost Codes while Budget Lines reference them. Select Budgets for deletion first.");
        }
      }
      if (!selected.has("boq")) {
        const [boqRef] = await db.select({ count: sql<number>`count(*)` }).from(boqGroups).where(eq(boqGroups.companyId, cid));
        if (Number(boqRef.count) > 0) {
          errors.push("Cannot delete Cost Codes while BOQ Groups reference them. Select Bill of Quantities for deletion first.");
        }
      }
      if (!selected.has("tenders")) {
        const [tenderLineRef] = await db.select({ count: sql<number>`count(*)` }).from(tenderLineItems).where(eq(tenderLineItems.companyId, cid));
        if (Number(tenderLineRef.count) > 0) {
          warnings.push("Tender line items reference cost codes. Those references will be cleared.");
        }
      }
      const companyCostCodeIds = (await db.select({ id: costCodes.id }).from(costCodes).where(eq(costCodes.companyId, cid))).map(r => r.id);
      if (companyCostCodeIds.length > 0) {
        const [childCount] = await db.select({ count: sql<number>`count(*)` }).from(childCostCodes).where(inArray(childCostCodes.parentCostCodeId, companyCostCodeIds));
        const [defaultCount] = await db.select({ count: sql<number>`count(*)` }).from(costCodeDefaults).where(inArray(costCodeDefaults.costCodeId, companyCostCodeIds));
        const [jobCodeCount] = await db.select({ count: sql<number>`count(*)` }).from(jobCostCodes).where(inArray(jobCostCodes.costCodeId, companyCostCodeIds));
        const totalRelated = Number(childCount.count) + Number(defaultCount.count) + Number(jobCodeCount.count);
        if (totalRelated > 0) {
          warnings.push(`${totalRelated} child cost code(s), job type default(s), and job cost code(s) will also be deleted.`);
        }
      }
    }
    
    if (selected.has("tenders")) {
      if (!selected.has("budgets")) {
        const [budgetTenderRef] = await db.select({ count: sql<number>`count(*)` }).from(budgetLines).where(
          and(eq(budgetLines.companyId, cid), isNotNull(budgetLines.selectedTenderSubmissionId))
        );
        if (Number(budgetTenderRef.count) > 0) {
          warnings.push("Budget lines reference tender submissions. Those references will be cleared.");
        }
      }
      if (!selected.has("boq")) {
        const [boqTenderRef] = await db.select({ count: sql<number>`count(*)` }).from(boqItems).where(
          and(eq(boqItems.companyId, cid), isNotNull(boqItems.tenderLineItemId))
        );
        if (Number(boqTenderRef.count) > 0) {
          warnings.push("BOQ items reference tender line items. Those references will be cleared.");
        }
      }
      const [submissionCount] = await db.select({ count: sql<number>`count(*)` }).from(tenderSubmissions).where(eq(tenderSubmissions.companyId, cid));
      const [lineItemCount] = await db.select({ count: sql<number>`count(*)` }).from(tenderLineItems).where(eq(tenderLineItems.companyId, cid));
      const [packageCount] = await db.select({ count: sql<number>`count(*)` }).from(tenderPackages).where(eq(tenderPackages.companyId, cid));
      const totalRelated = Number(submissionCount.count) + Number(lineItemCount.count) + Number(packageCount.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} tender submission(s), line item(s), and package(s) will also be deleted.`);
      }
    }
    
    if (selected.has("budgets")) {
      if (!selected.has("boq")) {
        const [boqBudgetRef] = await db.select({ count: sql<number>`count(*)` }).from(boqGroups).where(
          and(eq(boqGroups.companyId, cid), isNotNull(boqGroups.budgetLineId))
        );
        if (Number(boqBudgetRef.count) > 0) {
          warnings.push("BOQ groups reference budget lines. Those references will be cleared.");
        }
      }
      const [budgetLineCount] = await db.select({ count: sql<number>`count(*)` }).from(budgetLines).where(eq(budgetLines.companyId, cid));
      const companyBudgetIdsForFiles = (await db.select({ id: jobBudgets.id }).from(jobBudgets).where(eq(jobBudgets.companyId, cid))).map(r => r.id);
      const companyBudgetLineIdsForFiles = companyBudgetIdsForFiles.length > 0
        ? (await db.select({ id: budgetLines.id }).from(budgetLines).where(inArray(budgetLines.budgetId, companyBudgetIdsForFiles))).map(r => r.id)
        : [];
      const [budgetFileCount] = companyBudgetLineIdsForFiles.length > 0
        ? await db.select({ count: sql<number>`count(*)` }).from(budgetLineFiles).where(inArray(budgetLineFiles.budgetLineId, companyBudgetLineIdsForFiles))
        : [{ count: 0 }];
      const totalRelated = Number(budgetLineCount.count) + Number(budgetFileCount.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} budget line(s) and file(s) will also be deleted.`);
      }
    }
    
    if (selected.has("boq")) {
      const [boqItemCountVal] = await db.select({ count: sql<number>`count(*)` }).from(boqItems).where(eq(boqItems.companyId, cid));
      const [boqGroupCountVal] = await db.select({ count: sql<number>`count(*)` }).from(boqGroups).where(eq(boqGroups.companyId, cid));
      const totalRelated = Number(boqItemCountVal.count) + Number(boqGroupCountVal.count);
      if (totalRelated > 0) {
        warnings.push(`${totalRelated} BOQ group(s) and item(s) will be permanently deleted.`);
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
    const delCompanyId = req.companyId;

    if (selected.has("documents") && !selected.has("contracts")) {
      const [contractDocRef] = await db.select({ count: sql<number>`count(*)` }).from(contracts).where(isNotNull(contracts.aiSourceDocumentId));
      if (Number(contractDocRef.count) > 0) {
        return res.status(400).json({ error: "Cannot delete Documents while Contracts reference them. Select Contracts for deletion first." });
      }
    }

    const deletedCounts: Record<string, number> = {};

    await db.transaction(async (tx) => {
      if (selected.has("drafting_program")) {
        const result = await tx.delete(draftingProgram);
        deletedCounts.drafting_program = result.rowCount || 0;
      }
      
      if (selected.has("logistics")) {
        await tx.delete(deliveryRecords);
        await tx.delete(loadListPanels);
        const result = await tx.delete(loadLists);
        deletedCounts.logistics = result.rowCount || 0;
      }
      
      if (selected.has("daily_logs")) {
        await tx.delete(approvalEvents);
        await tx.delete(logRows);
        const result = await tx.delete(dailyLogs);
        deletedCounts.daily_logs = result.rowCount || 0;
      }
      
      if (selected.has("weekly_wages")) {
        const result = await tx.delete(weeklyWageReports);
        deletedCounts.weekly_wages = result.rowCount || 0;
      }
      
      if (selected.has("purchase_orders")) {
        await tx.delete(purchaseOrderAttachments);
        await tx.delete(purchaseOrderItems);
        const result = await tx.delete(purchaseOrders);
        deletedCounts.purchase_orders = result.rowCount || 0;
      }
      
      if (selected.has("chats")) {
        await tx.delete(chatNotifications);
        await tx.delete(chatMessageMentions);
        await tx.delete(chatMessageReactions);
        await tx.delete(chatMessageAttachments);
        await tx.delete(chatMessages);
        await tx.delete(conversationMembers);
        const result = await tx.delete(conversations);
        deletedCounts.chats = result.rowCount || 0;
        await tx.delete(userChatSettings);
      }
      
      if (selected.has("tasks")) {
        await tx.delete(taskNotifications);
        await tx.delete(taskFiles);
        await tx.delete(taskUpdates);
        await tx.delete(taskAssignees);
        await tx.delete(tasks);
        const result = await tx.delete(taskGroups);
        deletedCounts.tasks = result.rowCount || 0;
      }
      
      if (selected.has("panels")) {
        await tx.update(conversations).set({ panelId: null }).where(isNotNull(conversations.panelId));
        await tx.update(logRows).set({ panelRegisterId: null }).where(isNotNull(logRows.panelRegisterId));
        await tx.delete(productionEntries);
        const result = await tx.delete(panelRegister);
        deletedCounts.panels = result.rowCount || 0;
      }
      
      if (selected.has("production_slots")) {
        await tx.update(draftingProgram).set({ productionSlotId: null }).where(isNotNull(draftingProgram.productionSlotId));
        await tx.delete(productionSlotAdjustments);
        const result = await tx.delete(productionSlots);
        deletedCounts.production_slots = result.rowCount || 0;
      }
      
      if (selected.has("suppliers")) {
        await tx.delete(items);
        await tx.delete(itemCategories);
        const result = await tx.delete(suppliers);
        deletedCounts.suppliers = result.rowCount || 0;
      }
      
      if (selected.has("jobs")) {
        await tx.update(conversations).set({ jobId: null }).where(isNotNull(conversations.jobId));
        await tx.update(logRows).set({ jobId: null }).where(isNotNull(logRows.jobId));
        await tx.delete(weeklyJobReportSchedules);
        await tx.delete(weeklyJobReports);
        await tx.delete(productionDays);
        await tx.delete(jobPanelRates);
        await tx.delete(mappingRules);
        await tx.delete(jobLevelCycleTimes);
        const result = await tx.delete(jobs);
        deletedCounts.jobs = result.rowCount || 0;
      }
      
      if (selected.has("assets")) {
        await tx.delete(assetMaintenanceRecords);
        await tx.delete(assetTransfers);
        const result = await tx.delete(assets);
        deletedCounts.assets = result.rowCount || 0;
      }
      
      if (selected.has("contracts")) {
        const result = await tx.delete(contracts);
        deletedCounts.contracts = result.rowCount || 0;
      }
      
      if (selected.has("documents")) {
        await tx.delete(documentBundleItems);
        const result = await tx.delete(documents);
        deletedCounts.documents = result.rowCount || 0;
      }
      
      if (selected.has("progress_claims")) {
        await tx.delete(progressClaimItems);
        const result = await tx.delete(progressClaims);
        deletedCounts.progress_claims = result.rowCount || 0;
      }
      
      if (selected.has("broadcast_templates")) {
        await tx.delete(broadcastMessages);
        const result = await tx.delete(broadcastTemplates);
        deletedCounts.broadcast_templates = result.rowCount || 0;
      }
      
      if (selected.has("job_activities")) {
        await tx.delete(jobActivityFiles);
        await tx.delete(jobActivityUpdates);
        await tx.delete(jobActivityAssignees);
        await tx.update(tasks).set({ jobActivityId: null }).where(isNotNull(tasks.jobActivityId));
        const result = await tx.delete(jobActivities);
        deletedCounts.job_activities = result.rowCount || 0;
      }
      
      if (selected.has("activity_templates")) {
        await tx.delete(activityTemplateSubtasks);
        const result = await tx.delete(activityTemplates);
        deletedCounts.activity_templates = result.rowCount || 0;
      }
      
      if (selected.has("boq")) {
        if (delCompanyId) {
          await tx.delete(boqItems).where(eq(boqItems.companyId, delCompanyId));
          const result = await tx.delete(boqGroups).where(eq(boqGroups.companyId, delCompanyId));
          deletedCounts.boq = result.rowCount || 0;
        }
      }
      
      if (selected.has("budgets")) {
        if (delCompanyId) {
          if (!selected.has("boq")) {
            await tx.update(boqGroups).set({ budgetLineId: null }).where(and(eq(boqGroups.companyId, delCompanyId), isNotNull(boqGroups.budgetLineId)));
            await tx.update(boqItems).set({ budgetLineId: null }).where(and(eq(boqItems.companyId, delCompanyId), isNotNull(boqItems.budgetLineId)));
          }
          const companyBudgetIds = (await tx.select({ id: jobBudgets.id }).from(jobBudgets).where(eq(jobBudgets.companyId, delCompanyId))).map(r => r.id);
          if (companyBudgetIds.length > 0) {
            const companyBudgetLineIds = (await tx.select({ id: budgetLines.id }).from(budgetLines).where(inArray(budgetLines.budgetId, companyBudgetIds))).map(r => r.id);
            if (companyBudgetLineIds.length > 0) {
              await tx.delete(budgetLineFiles).where(inArray(budgetLineFiles.budgetLineId, companyBudgetLineIds));
            }
            await tx.delete(budgetLines).where(inArray(budgetLines.budgetId, companyBudgetIds));
          }
          const result = await tx.delete(jobBudgets).where(eq(jobBudgets.companyId, delCompanyId));
          deletedCounts.budgets = result.rowCount || 0;
        }
      }
      
      if (selected.has("tenders")) {
        if (delCompanyId) {
          if (!selected.has("budgets")) {
            await tx.update(budgetLines).set({ selectedTenderSubmissionId: null }).where(and(eq(budgetLines.companyId, delCompanyId), isNotNull(budgetLines.selectedTenderSubmissionId)));
          }
          if (!selected.has("boq")) {
            await tx.update(boqItems).set({ tenderLineItemId: null }).where(and(eq(boqItems.companyId, delCompanyId), isNotNull(boqItems.tenderLineItemId)));
          }
          const companyTenderIds = (await tx.select({ id: tenders.id }).from(tenders).where(eq(tenders.companyId, delCompanyId))).map(r => r.id);
          if (companyTenderIds.length > 0) {
            const companySubIds = (await tx.select({ id: tenderSubmissions.id }).from(tenderSubmissions).where(inArray(tenderSubmissions.tenderId, companyTenderIds))).map(r => r.id);
            if (companySubIds.length > 0) {
              const companyLineItemIds = (await tx.select({ id: tenderLineItems.id }).from(tenderLineItems).where(inArray(tenderLineItems.tenderSubmissionId, companySubIds))).map(r => r.id);
              if (companyLineItemIds.length > 0) {
                await tx.delete(tenderLineRisks).where(inArray(tenderLineRisks.lineItemId, companyLineItemIds));
                await tx.delete(tenderLineFiles).where(inArray(tenderLineFiles.lineItemId, companyLineItemIds));
                await tx.delete(tenderLineActivities).where(inArray(tenderLineActivities.lineItemId, companyLineItemIds));
              }
              await tx.delete(tenderLineItems).where(inArray(tenderLineItems.tenderSubmissionId, companySubIds));
              await tx.delete(tenderSubmissions).where(inArray(tenderSubmissions.tenderId, companyTenderIds));
            }
            await tx.delete(tenderPackages).where(inArray(tenderPackages.tenderId, companyTenderIds));
          }
          const result = await tx.delete(tenders).where(eq(tenders.companyId, delCompanyId));
          deletedCounts.tenders = result.rowCount || 0;
        }
      }
      
      if (selected.has("cost_codes")) {
        if (delCompanyId) {
          const companyCCIds = (await tx.select({ id: costCodes.id }).from(costCodes).where(eq(costCodes.companyId, delCompanyId))).map(r => r.id);
          if (companyCCIds.length > 0) {
            if (!selected.has("tenders")) {
              await tx.update(tenderLineItems).set({ costCodeId: null }).where(and(eq(tenderLineItems.companyId, delCompanyId), isNotNull(tenderLineItems.costCodeId)));
            }
            await tx.delete(jobCostCodes).where(inArray(jobCostCodes.costCodeId, companyCCIds));
            await tx.delete(costCodeDefaults).where(inArray(costCodeDefaults.costCodeId, companyCCIds));
            await tx.delete(childCostCodes).where(inArray(childCostCodes.parentCostCodeId, companyCCIds));
          }
          const result = await tx.delete(costCodes).where(eq(costCodes.companyId, delCompanyId));
          deletedCounts.cost_codes = result.rowCount || 0;
        }
      }
    });
    
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
