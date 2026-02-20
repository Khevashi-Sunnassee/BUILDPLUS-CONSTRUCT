import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { jobBudgets, budgetLines, budgetLineUpdates, budgetLineFiles, costCodes, childCostCodes, tenderSubmissions, tenders, tenderLineItems, suppliers, jobs, jobCostCodes, costCodeDefaults } from "@shared/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { budgetLineSchema } from "./shared";

const router = Router();

router.get("/api/jobs/:jobId/budget/lines", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

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
      .orderBy(asc(budgetLines.sortOrder))
      .limit(1000);

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
    logger.error({ error }, "Error fetching budget lines");
    res.status(500).json({ message: "Failed to fetch budget lines" });
  }
});

router.post("/api/jobs/:jobId/budget/lines", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
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
    logger.error({ error }, "Error creating budget line");
    res.status(500).json({ message: "Failed to create budget line" });
  }
});

router.patch("/api/jobs/:jobId/budget/lines/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
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
      .where(and(eq(budgetLines.id, id), eq(budgetLines.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Budget line not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error updating budget line");
    res.status(500).json({ message: "Failed to update budget line" });
  }
});

router.delete("/api/jobs/:jobId/budget/lines/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [deleted] = await db
      .delete(budgetLines)
      .where(and(eq(budgetLines.id, id), eq(budgetLines.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Budget line not found" });
    }
    res.json({ message: "Budget line deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting budget line");
    res.status(500).json({ message: "Failed to delete budget line" });
  }
});

router.post("/api/jobs/:jobId/budget/lines/create-from-cost-codes", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

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
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code))
      .limit(1000);

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
        .where(and(eq(costCodeDefaults.jobTypeId, job.jobTypeId), eq(costCodeDefaults.companyId, companyId)))
        .limit(1000);

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
          .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code))
          .limit(1000);
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
      .orderBy(asc(childCostCodes.sortOrder), asc(childCostCodes.code))
      .limit(1000);

    const existingLines = await db
      .select({ costCodeId: budgetLines.costCodeId, childCostCodeId: budgetLines.childCostCodeId })
      .from(budgetLines)
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)))
      .limit(1000);

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

    await db.insert(budgetLines).values(insertValues as any);

    const inheritedMsg = inherited > 0 ? ` (${inherited} cost code(s) inherited from job type)` : "";
    res.json({
      created: insertValues.length,
      inherited,
      message: `Created ${insertValues.length} budget line(s) from cost codes.${inheritedMsg}`,
    });
  } catch (error: unknown) {
    logger.error({ error }, "Error creating budget lines from cost codes");
    res.status(500).json({ message: "Failed to create budget lines from cost codes" });
  }
});

export default router;
