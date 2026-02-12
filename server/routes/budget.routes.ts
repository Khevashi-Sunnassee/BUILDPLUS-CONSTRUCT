import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { jobBudgets, budgetLines, budgetLineFiles, costCodes, childCostCodes, tenderSubmissions, suppliers, jobs, jobCostCodes, costCodeDefaults } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

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

    const mappedLines = lines.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
      tenderSubmission: row.tenderSubmission?.id ? row.tenderSubmission : null,
      contractor: row.contractor?.id ? row.contractor : null,
    }));

    res.json({ ...budget, lines: mappedLines });
  } catch (error: any) {
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
  } catch (error: any) {
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

    const updateData: Record<string, any> = { updatedAt: new Date() };

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
  } catch (error: any) {
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

    const mapped = results.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
      tenderSubmission: row.tenderSubmission?.id ? row.tenderSubmission : null,
      contractor: row.contractor?.id ? row.contractor : null,
    }));

    res.json(mapped);
  } catch (error: any) {
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
  } catch (error: any) {
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

    const updateData: Record<string, any> = { updatedAt: new Date() };

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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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

      await db.insert(jobCostCodes).values(
        defaults.map((d, idx) => ({
          companyId,
          jobId,
          costCodeId: d.costCodeId,
          sortOrder: idx,
        }))
      );
      inherited = defaults.length;

      jobCostCodeRows = await db
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
    }

    const existingLines = await db
      .select({ costCodeId: budgetLines.costCodeId })
      .from(budgetLines)
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)));

    const existingCostCodeIds = new Set(existingLines.map(l => l.costCodeId));

    const newCostCodes = jobCostCodeRows.filter(
      cc => cc.isActive && !cc.isDisabled && !existingCostCodeIds.has(cc.costCodeId)
    );

    if (newCostCodes.length === 0) {
      return res.json({ created: 0, skipped: jobCostCodeRows.length, message: "All cost codes already have budget lines or are inactive/disabled." });
    }

    const insertValues = newCostCodes.map((cc, idx) => ({
      companyId,
      budgetId: budget.id,
      jobId,
      costCodeId: cc.costCodeId,
      estimatedBudget: "0",
      variationsAmount: "0",
      forecastCost: "0",
      sortOrder: existingLines.length + idx,
    }));

    await db.insert(budgetLines).values(insertValues);

    const inheritedMsg = inherited > 0 ? ` (${inherited} cost code(s) inherited from job type)` : "";
    res.json({
      created: newCostCodes.length,
      inherited,
      skipped: jobCostCodeRows.length - newCostCodes.length,
      message: `Created ${newCostCodes.length} budget line(s) from cost codes.${inheritedMsg}`,
    });
  } catch (error: any) {
    logger.error("Error creating budget lines from cost codes:", error);
    res.status(500).json({ message: "Failed to create budget lines from cost codes" });
  }
});

export const budgetRouter = router;
