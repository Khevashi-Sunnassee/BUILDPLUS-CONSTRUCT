import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { jobBudgets, budgetLines, budgetLineUpdates, budgetLineFiles, costCodes, childCostCodes, tenderSubmissions, tenderLineItems, tenders, suppliers, jobs } from "@shared/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { budgetSchema } from "./shared";

const router = Router();

router.get("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

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
      .orderBy(asc(budgetLines.sortOrder))
      .limit(1000);

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
    logger.error({ error }, "Error fetching budget");
    res.status(500).json({ message: "Failed to fetch budget" });
  }
});

router.post("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
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
    logger.error({ error }, "Error creating budget");
    res.status(500).json({ message: "Failed to create budget" });
  }
});

router.patch("/api/jobs/:jobId/budget", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
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
    logger.error({ error }, "Error updating budget");
    res.status(500).json({ message: "Failed to update budget" });
  }
});

router.get("/api/jobs/:jobId/budget/summary", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

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
    logger.error({ error }, "Error fetching budget summary");
    res.status(500).json({ message: "Failed to fetch budget summary" });
  }
});

export default router;
