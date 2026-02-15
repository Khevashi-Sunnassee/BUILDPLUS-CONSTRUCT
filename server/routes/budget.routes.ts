import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { jobBudgets, budgetLines, budgetLineFiles, budgetLineUpdates, budgetLineDetailItems, costCodes, childCostCodes, tenderSubmissions, tenders, tenderLineItems, suppliers, jobs, jobCostCodes, costCodeDefaults, users } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

const budgetSchema = z.object({
  estimatedTotalBudget: z.string().nullable().optional(),
  profitTargetPercent: z.string().nullable().optional(),
  customerPrice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const budgetLineSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  estimatedBudget: z.string().nullable().optional(),
  selectedTenderSubmissionId: z.string().nullable().optional(),
  selectedContractorId: z.string().nullable().optional(),
  variationsAmount: z.string().nullable().optional(),
  forecastCost: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [budget] = await db
      .select()
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.json(null);
    }

    const lines = await db
      .select({
        line: budgetLines,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
        tenderSubmission: {
          id: tenderSubmissions.id,
          totalPrice: tenderSubmissions.totalPrice,
          status: tenderSubmissions.status,
        },
        contractor: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(budgetLines)
      .innerJoin(costCodes, eq(budgetLines.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(budgetLines.childCostCodeId, childCostCodes.id))
      .leftJoin(tenderSubmissions, eq(budgetLines.selectedTenderSubmissionId, tenderSubmissions.id))
      .leftJoin(suppliers, eq(budgetLines.selectedContractorId, suppliers.id))
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)))
      .orderBy(asc(budgetLines.sortOrder));

    const lineIds = lines.map(l => l.line.id);

    let updatesCounts: Record<string, number> = {};
    let filesCounts: Record<string, number> = {};

    if (lineIds.length > 0) {
      const [updatesCountRows, filesCountRows] = await Promise.all([
        db.select({
          budgetLineId: budgetLineUpdates.budgetLineId,
          count: sql<number>`count(*)::int`,
        })
          .from(budgetLineUpdates)
          .where(inArray(budgetLineUpdates.budgetLineId, lineIds))
          .groupBy(budgetLineUpdates.budgetLineId),
        db.select({
          budgetLineId: budgetLineFiles.budgetLineId,
          count: sql<number>`count(*)::int`,
        })
          .from(budgetLineFiles)
          .where(inArray(budgetLineFiles.budgetLineId, lineIds))
          .groupBy(budgetLineFiles.budgetLineId),
      ]);

      for (const row of updatesCountRows) {
        updatesCounts[row.budgetLineId] = row.count;
      }
      for (const row of filesCountRows) {
        filesCounts[row.budgetLineId] = row.count;
      }
    }

    let tenderCounts: Record<string, number> = {};
    const uniqueCostCodeIds = [...new Set(lines.map(l => l.line.costCodeId))];
    if (uniqueCostCodeIds.length > 0) {
      const tenderCountRows = await db
        .select({
          costCodeId: tenderLineItems.costCodeId,
          count: sql<number>`count(distinct ${tenderSubmissions.id})::int`,
        })
        .from(tenderLineItems)
        .innerJoin(tenderSubmissions, eq(tenderLineItems.tenderSubmissionId, tenderSubmissions.id))
        .innerJoin(tenders, eq(tenderSubmissions.tenderId, tenders.id))
        .where(and(
          eq(tenders.jobId, jobId),
          eq(tenders.companyId, companyId),
          inArray(tenderLineItems.costCodeId, uniqueCostCodeIds),
        ))
        .groupBy(tenderLineItems.costCodeId);

      for (const row of tenderCountRows) {
        if (row.costCodeId) {
          tenderCounts[row.costCodeId] = row.count;
        }
      }
    }

    const mappedLines = lines.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
      tenderSubmission: row.tenderSubmission?.id ? row.tenderSubmission : null,
      contractor: row.contractor?.id ? row.contractor : null,
      updatesCount: updatesCounts[row.line.id] || 0,
      filesCount: filesCounts[row.line.id] || 0,
      tenderCount: tenderCounts[row.line.costCodeId] || 0,
    }));

    res.json({ ...budget, lines: mappedLines });
  } catch (error: unknown) {
    logger.error("Error fetching budget:", error);
    res.status(500).json({ message: "Failed to fetch budget" });
  }
});

router.post("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const jobId = req.params.jobId;
    const data = budgetSchema.parse(req.body);

    const [existingBudget] = await db
      .select()
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (existingBudget) {
      return res.status(409).json({ message: "Budget already exists for this job" });
    }

    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const [result] = await db
      .insert(jobBudgets)
      .values({
        companyId,
        jobId,
        estimatedTotalBudget: data.estimatedTotalBudget || "0",
        profitTargetPercent: data.profitTargetPercent || "0",
        customerPrice: data.customerPrice || "0",
        notes: data.notes || null,
        createdById: userId,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating budget:", error);
    res.status(500).json({ message: "Failed to create budget" });
  }
});

router.patch("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const data = budgetSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.estimatedTotalBudget !== undefined) updateData.estimatedTotalBudget = data.estimatedTotalBudget || "0";
    if (data.profitTargetPercent !== undefined) updateData.profitTargetPercent = data.profitTargetPercent || "0";
    if (data.customerPrice !== undefined) updateData.customerPrice = data.customerPrice || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const [result] = await db
      .update(jobBudgets)
      .set(updateData)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Budget not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating budget:", error);
    res.status(500).json({ message: "Failed to update budget" });
  }
});

router.get("/api/jobs/:jobId/budget/lines", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [budget] = await db
      .select({ id: jobBudgets.id })
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.json([]);
    }

    const results = await db
      .select({
        line: budgetLines,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
        tenderSubmission: {
          id: tenderSubmissions.id,
          totalPrice: tenderSubmissions.totalPrice,
          status: tenderSubmissions.status,
        },
        contractor: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(budgetLines)
      .innerJoin(costCodes, eq(budgetLines.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(budgetLines.childCostCodeId, childCostCodes.id))
      .leftJoin(tenderSubmissions, eq(budgetLines.selectedTenderSubmissionId, tenderSubmissions.id))
      .leftJoin(suppliers, eq(budgetLines.selectedContractorId, suppliers.id))
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)))
      .orderBy(asc(budgetLines.sortOrder));

    const lineIds = results.map(r => r.line.id);
    let updatesCounts: Record<string, number> = {};
    let filesCounts: Record<string, number> = {};
    let tenderCounts: Record<string, number> = {};

    if (lineIds.length > 0) {
      const updatesCountRows = await db
        .select({
          budgetLineId: budgetLineUpdates.budgetLineId,
          count: sql<number>`count(*)::int`,
        })
        .from(budgetLineUpdates)
        .where(inArray(budgetLineUpdates.budgetLineId, lineIds))
        .groupBy(budgetLineUpdates.budgetLineId);
      for (const row of updatesCountRows) {
        updatesCounts[row.budgetLineId] = row.count;
      }

      const filesCountRows = await db
        .select({
          budgetLineId: budgetLineFiles.budgetLineId,
          count: sql<number>`count(*)::int`,
        })
        .from(budgetLineFiles)
        .where(inArray(budgetLineFiles.budgetLineId, lineIds))
        .groupBy(budgetLineFiles.budgetLineId);
      for (const row of filesCountRows) {
        filesCounts[row.budgetLineId] = row.count;
      }

      const uniqueCostCodeIds = [...new Set(results.map(r => r.line.costCodeId))];
      if (uniqueCostCodeIds.length > 0) {
        const tenderCountRows = await db
          .select({
            costCodeId: tenderLineItems.costCodeId,
            count: sql<number>`count(distinct ${tenderSubmissions.id})::int`,
          })
          .from(tenderLineItems)
          .innerJoin(tenderSubmissions, eq(tenderLineItems.tenderSubmissionId, tenderSubmissions.id))
          .innerJoin(tenders, eq(tenderSubmissions.tenderId, tenders.id))
          .where(and(
            eq(tenders.jobId, jobId),
            eq(tenders.companyId, companyId),
            inArray(tenderLineItems.costCodeId, uniqueCostCodeIds),
          ))
          .groupBy(tenderLineItems.costCodeId);
        for (const row of tenderCountRows) {
          if (row.costCodeId) {
            tenderCounts[row.costCodeId] = row.count;
          }
        }
      }
    }

    const mapped = results.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
      tenderSubmission: row.tenderSubmission?.id ? row.tenderSubmission : null,
      contractor: row.contractor?.id ? row.contractor : null,
      updatesCount: updatesCounts[row.line.id] || 0,
      filesCount: filesCounts[row.line.id] || 0,
      tenderCount: tenderCounts[row.line.costCodeId] || 0,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching budget lines:", error);
    res.status(500).json({ message: "Failed to fetch budget lines" });
  }
});

router.post("/api/jobs/:jobId/budget/lines", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const data = budgetLineSchema.parse(req.body);

    const [budget] = await db
      .select({ id: jobBudgets.id })
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.status(404).json({ message: "Budget not found for this job. Create a budget first." });
    }

    const [result] = await db
      .insert(budgetLines)
      .values({
        companyId,
        budgetId: budget.id,
        jobId,
        costCodeId: data.costCodeId,
        childCostCodeId: data.childCostCodeId || null,
        estimatedBudget: data.estimatedBudget || "0",
        selectedTenderSubmissionId: data.selectedTenderSubmissionId || null,
        selectedContractorId: data.selectedContractorId || null,
        variationsAmount: data.variationsAmount || "0",
        forecastCost: data.forecastCost || "0",
        notes: data.notes || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating budget line:", error);
    res.status(500).json({ message: "Failed to create budget line" });
  }
});

router.patch("/api/jobs/:jobId/budget/lines/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = budgetLineSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId;
    if (data.childCostCodeId !== undefined) updateData.childCostCodeId = data.childCostCodeId || null;
    if (data.estimatedBudget !== undefined) updateData.estimatedBudget = data.estimatedBudget || "0";
    if (data.selectedTenderSubmissionId !== undefined) updateData.selectedTenderSubmissionId = data.selectedTenderSubmissionId || null;
    if (data.selectedContractorId !== undefined) updateData.selectedContractorId = data.selectedContractorId || null;
    if (data.variationsAmount !== undefined) updateData.variationsAmount = data.variationsAmount || "0";
    if (data.forecastCost !== undefined) updateData.forecastCost = data.forecastCost || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const [result] = await db
      .update(budgetLines)
      .set(updateData)
      .where(and(eq(budgetLines.id, req.params.id), eq(budgetLines.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Budget line not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating budget line:", error);
    res.status(500).json({ message: "Failed to update budget line" });
  }
});

router.delete("/api/jobs/:jobId/budget/lines/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [deleted] = await db
      .delete(budgetLines)
      .where(and(eq(budgetLines.id, req.params.id), eq(budgetLines.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Budget line not found" });
    }
    res.json({ message: "Budget line deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error("Error deleting budget line:", error);
    res.status(500).json({ message: "Failed to delete budget line" });
  }
});

router.get("/api/jobs/:jobId/budget/summary", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [budget] = await db
      .select()
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.json({
        budget: null,
        totalEstimatedBudget: "0",
        totalTenderAmounts: "0",
        totalVariations: "0",
        totalForecastCost: "0",
        lineCount: 0,
        customerPrice: "0",
        profitTargetPercent: "0",
        profitMargin: "0",
      });
    }

    const [summary] = await db
      .select({
        totalEstimatedBudget: sql<string>`COALESCE(SUM(CAST(${budgetLines.estimatedBudget} AS DECIMAL(14,2))), 0)`,
        totalVariations: sql<string>`COALESCE(SUM(CAST(${budgetLines.variationsAmount} AS DECIMAL(14,2))), 0)`,
        totalForecastCost: sql<string>`COALESCE(SUM(CAST(${budgetLines.forecastCost} AS DECIMAL(14,2))), 0)`,
        lineCount: sql<number>`COUNT(*)::int`,
      })
      .from(budgetLines)
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)));

    const tenderResult = await db
      .select({
        totalTenderAmounts: sql<string>`COALESCE(SUM(CAST(${tenderSubmissions.totalPrice} AS DECIMAL(14,2))), 0)`,
      })
      .from(budgetLines)
      .innerJoin(tenderSubmissions, eq(budgetLines.selectedTenderSubmissionId, tenderSubmissions.id))
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)));

    const totalTenderAmounts = tenderResult[0]?.totalTenderAmounts || "0";

    const customerPrice = parseFloat(budget.customerPrice || "0");
    const totalForecast = parseFloat(summary?.totalForecastCost || "0");
    const profitMargin = customerPrice > 0 ? (((customerPrice - totalForecast) / customerPrice) * 100).toFixed(2) : "0";

    res.json({
      budget,
      totalEstimatedBudget: summary?.totalEstimatedBudget || "0",
      totalTenderAmounts,
      totalVariations: summary?.totalVariations || "0",
      totalForecastCost: summary?.totalForecastCost || "0",
      lineCount: summary?.lineCount || 0,
      customerPrice: budget.customerPrice || "0",
      profitTargetPercent: budget.profitTargetPercent || "0",
      profitMargin,
    });
  } catch (error: unknown) {
    logger.error("Error fetching budget summary:", error);
    res.status(500).json({ message: "Failed to fetch budget summary" });
  }
});

router.post("/api/jobs/:jobId/budget/lines/create-from-cost-codes", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [budget] = await db
      .select({ id: jobBudgets.id })
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.status(404).json({ message: "Budget not found for this job. Create a budget first." });
    }

    let jobCostCodeRows = await db
      .select({
        costCodeId: jobCostCodes.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        isActive: costCodes.isActive,
        isDisabled: jobCostCodes.isDisabled,
        sortOrder: jobCostCodes.sortOrder,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));

    let inherited = 0;
    if (jobCostCodeRows.length === 0) {
      const [job] = await db
        .select({ id: jobs.id, jobTypeId: jobs.jobTypeId })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));

      if (!job) {
        return res.status(404).json({ message: "Job not found." });
      }
      if (!job.jobTypeId) {
        return res.status(400).json({ message: "This job has no job type assigned. Set a job type first so cost codes can be determined." });
      }

      const defaults = await db
        .select({ costCodeId: costCodeDefaults.costCodeId })
        .from(costCodeDefaults)
        .where(and(eq(costCodeDefaults.jobTypeId, job.jobTypeId), eq(costCodeDefaults.companyId, companyId)));

      if (defaults.length === 0) {
        return res.status(400).json({ message: "No default cost codes are configured for this job type. Go to Admin > Cost Codes to set up defaults for this job type." });
      }

      await db.transaction(async (tx) => {
        await tx.insert(jobCostCodes).values(
          defaults.map((d, idx) => ({
            companyId,
            jobId,
            costCodeId: d.costCodeId,
            sortOrder: idx,
          }))
        );
        inherited = defaults.length;

        jobCostCodeRows = await tx
          .select({
            costCodeId: jobCostCodes.costCodeId,
            costCode: costCodes.code,
            costCodeName: costCodes.name,
            isActive: costCodes.isActive,
            isDisabled: jobCostCodes.isDisabled,
            sortOrder: jobCostCodes.sortOrder,
          })
          .from(jobCostCodes)
          .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
          .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
          .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));
      });
    }

    const activeCostCodes = jobCostCodeRows.filter(cc => cc.isActive && !cc.isDisabled);

    if (activeCostCodes.length === 0) {
      return res.json({ created: 0, skipped: jobCostCodeRows.length, message: "All cost codes are inactive or disabled." });
    }

    const parentIds = activeCostCodes.map(cc => cc.costCodeId);
    const allChildCodes = await db
      .select({
        id: childCostCodes.id,
        parentCostCodeId: childCostCodes.parentCostCodeId,
        code: childCostCodes.code,
        name: childCostCodes.name,
        isActive: childCostCodes.isActive,
        sortOrder: childCostCodes.sortOrder,
      })
      .from(childCostCodes)
      .where(and(
        eq(childCostCodes.companyId, companyId),
        inArray(childCostCodes.parentCostCodeId, parentIds),
        eq(childCostCodes.isActive, true)
      ))
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code));

    const existingLines = await db
      .select({ costCodeId: budgetLines.costCodeId, childCostCodeId: budgetLines.childCostCodeId })
      .from(budgetLines)
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)));

    const existingKey = new Set(existingLines.map(l => `${l.costCodeId}|${l.childCostCodeId || ""}`));

    const insertValues: Record<string, unknown>[] = [];
    let sortIdx = existingLines.length;

    for (const parentCC of activeCostCodes) {
      const children = allChildCodes.filter(c => c.parentCostCodeId === parentCC.costCodeId);

      if (children.length > 0) {
        for (const child of children) {
          const key = `${parentCC.costCodeId}|${child.id}`;
          if (!existingKey.has(key)) {
            insertValues.push({
              companyId,
              budgetId: budget.id,
              jobId,
              costCodeId: parentCC.costCodeId,
              childCostCodeId: child.id,
              estimatedBudget: "0",
              variationsAmount: "0",
              forecastCost: "0",
              sortOrder: sortIdx++,
            });
          }
        }
      } else {
        const key = `${parentCC.costCodeId}|`;
        if (!existingKey.has(key)) {
          insertValues.push({
            companyId,
            budgetId: budget.id,
            jobId,
            costCodeId: parentCC.costCodeId,
            childCostCodeId: null,
            estimatedBudget: "0",
            variationsAmount: "0",
            forecastCost: "0",
            sortOrder: sortIdx++,
          });
        }
      }
    }

    if (insertValues.length === 0) {
      return res.json({ created: 0, skipped: activeCostCodes.length, message: "All cost codes already have budget lines." });
    }

    await db.insert(budgetLines).values(insertValues);

    const inheritedMsg = inherited > 0 ? ` (${inherited} cost code(s) inherited from job type)` : "";
    res.json({
      created: insertValues.length,
      inherited,
      message: `Created ${insertValues.length} budget line(s) from cost codes.${inheritedMsg}`,
    });
  } catch (error: unknown) {
    logger.error("Error creating budget lines from cost codes:", error);
    res.status(500).json({ message: "Failed to create budget lines from cost codes" });
  }
});

// ============================================================================
// Budget Line Updates (Comments)
// ============================================================================

router.get("/api/budget-lines/:lineId/updates", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = req.params.lineId;
    const updates = await db
      .select({
        id: budgetLineUpdates.id,
        budgetLineId: budgetLineUpdates.budgetLineId,
        userId: budgetLineUpdates.userId,
        content: budgetLineUpdates.content,
        createdAt: budgetLineUpdates.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(budgetLineUpdates)
      .innerJoin(users, eq(budgetLineUpdates.userId, users.id))
      .where(eq(budgetLineUpdates.budgetLineId, lineId))
      .orderBy(desc(budgetLineUpdates.createdAt));

    const filesForUpdates = await db
      .select()
      .from(budgetLineFiles)
      .where(and(
        eq(budgetLineFiles.budgetLineId, lineId),
        sql`${budgetLineFiles.updateId} IS NOT NULL`
      ));

    const updatesWithFiles = updates.map(u => ({
      ...u,
      files: filesForUpdates.filter(f => f.updateId === u.id),
    }));

    res.json(updatesWithFiles);
  } catch (error: unknown) {
    logger.error("Error fetching budget line updates:", error);
    res.status(500).json({ message: "Failed to fetch updates" });
  }
});

router.post("/api/budget-lines/:lineId/updates", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = req.params.lineId;
    const userId = req.session.userId!;
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);

    const [update] = await db
      .insert(budgetLineUpdates)
      .values({ budgetLineId: lineId, userId, content })
      .returning();

    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error("Error creating budget line update:", error);
    res.status(500).json({ message: "Failed to create update" });
  }
});

router.delete("/api/budget-line-updates/:id", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [update] = await db.select({ id: budgetLineUpdates.id, budgetLineId: budgetLineUpdates.budgetLineId })
      .from(budgetLineUpdates)
      .innerJoin(budgetLines, eq(budgetLineUpdates.budgetLineId, budgetLines.id))
      .where(and(eq(budgetLineUpdates.id, req.params.id), eq(budgetLines.companyId, companyId)));
    if (!update) return res.status(404).json({ message: "Update not found" });
    await db.delete(budgetLineUpdates).where(eq(budgetLineUpdates.id, req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting budget line update:", error);
    res.status(500).json({ message: "Failed to delete update" });
  }
});

// ============================================================================
// Budget Line Files
// ============================================================================

router.get("/api/budget-lines/:lineId/files", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = req.params.lineId;
    const files = await db
      .select({
        id: budgetLineFiles.id,
        budgetLineId: budgetLineFiles.budgetLineId,
        updateId: budgetLineFiles.updateId,
        fileName: budgetLineFiles.fileName,
        fileUrl: budgetLineFiles.fileUrl,
        fileSize: budgetLineFiles.fileSize,
        mimeType: budgetLineFiles.mimeType,
        uploadedById: budgetLineFiles.uploadedById,
        createdAt: budgetLineFiles.createdAt,
        uploadedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(budgetLineFiles)
      .leftJoin(users, eq(budgetLineFiles.uploadedById, users.id))
      .where(eq(budgetLineFiles.budgetLineId, lineId))
      .orderBy(desc(budgetLineFiles.createdAt));

    res.json(files);
  } catch (error: unknown) {
    logger.error("Error fetching budget line files:", error);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

router.post("/api/budget-lines/:lineId/files", requireAuth, requirePermission("budgets", "VIEW"), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const lineId = req.params.lineId;
    const userId = req.session.userId!;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const updateId = req.body.updateId || null;

    const [created] = await db
      .insert(budgetLineFiles)
      .values({
        budgetLineId: lineId,
        updateId,
        fileName: file.originalname,
        fileUrl: dataUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: unknown) {
    logger.error("Error uploading budget line file:", error);
    res.status(500).json({ message: "Failed to upload file" });
  }
});

router.delete("/api/budget-line-files/:id", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [file] = await db.select({ id: budgetLineFiles.id })
      .from(budgetLineFiles)
      .innerJoin(budgetLines, eq(budgetLineFiles.budgetLineId, budgetLines.id))
      .where(and(eq(budgetLineFiles.id, req.params.id), eq(budgetLines.companyId, companyId)));
    if (!file) return res.status(404).json({ message: "File not found" });
    await db.delete(budgetLineFiles).where(eq(budgetLineFiles.id, req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting budget line file:", error);
    res.status(500).json({ message: "Failed to delete file" });
  }
});

// ==================== Budget Line Detail Items ====================

const detailItemSchema = z.object({
  item: z.string().min(1, "Item description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

router.get("/api/budget-lines/:budgetLineId/detail-items", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { budgetLineId } = req.params;

    const items = await db
      .select()
      .from(budgetLineDetailItems)
      .where(and(
        eq(budgetLineDetailItems.budgetLineId, budgetLineId),
        eq(budgetLineDetailItems.companyId, companyId),
      ))
      .orderBy(asc(budgetLineDetailItems.sortOrder), asc(budgetLineDetailItems.createdAt));

    res.json(items);
  } catch (error: unknown) {
    logger.error("Error fetching budget line detail items:", error);
    res.status(500).json({ message: "Failed to fetch detail items" });
  }
});

router.post("/api/budget-lines/:budgetLineId/detail-items", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { budgetLineId } = req.params;
    const data = detailItemSchema.parse(req.body);

    const qty = parseFloat(data.quantity || "0");
    const price = parseFloat(data.price || "0");
    const lineTotal = (qty * price).toFixed(2);

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${budgetLineDetailItems.sortOrder}), -1)` })
      .from(budgetLineDetailItems)
      .where(eq(budgetLineDetailItems.budgetLineId, budgetLineId));

    const [newItem] = await db.insert(budgetLineDetailItems).values({
      companyId,
      budgetLineId,
      item: data.item,
      quantity: data.quantity || "0",
      unit: data.unit || "EA",
      price: data.price || "0",
      lineTotal,
      notes: data.notes || null,
      sortOrder: data.sortOrder ?? (maxOrder[0]?.max ?? -1) + 1,
    }).returning();

    await recalcLockedBudget(budgetLineId, companyId);

    res.json(newItem);
  } catch (error: unknown) {
    logger.error("Error creating budget line detail item:", error);
    res.status(500).json({ message: "Failed to create detail item" });
  }
});

router.patch("/api/budget-line-detail-items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id } = req.params;
    const data = detailItemSchema.partial().parse(req.body);

    const [existing] = await db.select().from(budgetLineDetailItems).where(and(
      eq(budgetLineDetailItems.id, id),
      eq(budgetLineDetailItems.companyId, companyId),
    ));
    if (!existing) return res.status(404).json({ message: "Item not found" });

    const qty = parseFloat(data.quantity ?? existing.quantity ?? "0");
    const price = parseFloat(data.price ?? existing.price ?? "0");
    const lineTotal = (qty * price).toFixed(2);

    const [updated] = await db.update(budgetLineDetailItems)
      .set({
        ...(data.item !== undefined && { item: data.item }),
        ...(data.quantity !== undefined && { quantity: data.quantity || "0" }),
        ...(data.unit !== undefined && { unit: data.unit || "EA" }),
        ...(data.price !== undefined && { price: data.price || "0" }),
        lineTotal,
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(and(eq(budgetLineDetailItems.id, id), eq(budgetLineDetailItems.companyId, companyId)))
      .returning();

    await recalcLockedBudget(existing.budgetLineId, companyId);

    res.json(updated);
  } catch (error: unknown) {
    logger.error("Error updating budget line detail item:", error);
    res.status(500).json({ message: "Failed to update detail item" });
  }
});

router.delete("/api/budget-line-detail-items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id } = req.params;

    const [existing] = await db.select().from(budgetLineDetailItems).where(and(
      eq(budgetLineDetailItems.id, id),
      eq(budgetLineDetailItems.companyId, companyId),
    ));
    if (!existing) return res.status(404).json({ message: "Item not found" });

    await db.delete(budgetLineDetailItems).where(eq(budgetLineDetailItems.id, id));

    await recalcLockedBudget(existing.budgetLineId, companyId);

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting budget line detail item:", error);
    res.status(500).json({ message: "Failed to delete detail item" });
  }
});

router.patch("/api/budget-lines/:budgetLineId/toggle-lock", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { budgetLineId } = req.params;
    const { locked } = req.body;

    const [line] = await db.select().from(budgetLines).where(and(
      eq(budgetLines.id, budgetLineId),
      eq(budgetLines.companyId, companyId),
    ));
    if (!line) return res.status(404).json({ message: "Budget line not found" });

    await db.update(budgetLines)
      .set({ estimateLocked: !!locked, updatedAt: new Date() })
      .where(eq(budgetLines.id, budgetLineId));

    if (locked) {
      await recalcLockedBudget(budgetLineId, companyId);
    }

    res.json({ success: true, locked: !!locked });
  } catch (error: unknown) {
    logger.error("Error toggling budget lock:", error);
    res.status(500).json({ message: "Failed to toggle lock" });
  }
});

async function recalcLockedBudget(budgetLineId: string, companyId: string) {
  const [line] = await db.select().from(budgetLines).where(and(
    eq(budgetLines.id, budgetLineId),
    eq(budgetLines.companyId, companyId),
  ));
  if (!line || !line.estimateLocked) return;

  const [sumResult] = await db
    .select({ total: sql<string>`coalesce(sum(${budgetLineDetailItems.lineTotal}), '0')` })
    .from(budgetLineDetailItems)
    .where(eq(budgetLineDetailItems.budgetLineId, budgetLineId));

  await db.update(budgetLines)
    .set({ estimatedBudget: sumResult.total, updatedAt: new Date() })
    .where(eq(budgetLines.id, budgetLineId));
}

export const budgetRouter = router;
