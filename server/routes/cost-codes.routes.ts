import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { costCodes, costCodeDefaults, jobCostCodes, jobTypes, jobs } from "@shared/schema";
import { eq, and, desc, asc, sql, ilike, or, inArray } from "drizzle-orm";

const router = Router();

const costCodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { search, active } = req.query;

    let conditions = [eq(costCodes.companyId, companyId)];

    if (active === "true") {
      conditions.push(eq(costCodes.isActive, true));
    } else if (active === "false") {
      conditions.push(eq(costCodes.isActive, false));
    }

    let results = await db
      .select()
      .from(costCodes)
      .where(and(...conditions))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    if (search && typeof search === "string" && search.trim()) {
      const s = search.trim().toLowerCase();
      results = results.filter(
        (cc) =>
          cc.code.toLowerCase().includes(s) ||
          cc.name.toLowerCase().includes(s) ||
          (cc.description && cc.description.toLowerCase().includes(s))
      );
    }

    res.json(results);
  } catch (error: any) {
    logger.error("Error fetching cost codes:", error);
    res.status(500).json({ message: "Failed to fetch cost codes" });
  }
});

router.get("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [result] = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)));

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: any) {
    logger.error("Error fetching cost code:", error);
    res.status(500).json({ message: "Failed to fetch cost code" });
  }
});

router.post("/api/cost-codes", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = costCodeSchema.parse(req.body);

    const existing = await db
      .select()
      .from(costCodes)
      .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)));

    if (existing.length > 0) {
      return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
    }

    const [result] = await db
      .insert(costCodes)
      .values({
        companyId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        parentId: data.parentId || null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error creating cost code:", error);
    res.status(500).json({ message: "Failed to create cost code" });
  }
});

router.patch("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = costCodeSchema.partial().parse(req.body);

    if (data.code) {
      const existing = await db
        .select()
        .from(costCodes)
        .where(and(eq(costCodes.code, data.code), eq(costCodes.companyId, companyId)));

      if (existing.length > 0 && existing[0].id !== req.params.id) {
        return res.status(409).json({ message: `Cost code "${data.code}" already exists` });
      }
    }

    const [result] = await db
      .update(costCodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating cost code:", error);
    res.status(500).json({ message: "Failed to update cost code" });
  }
});

router.delete("/api/cost-codes/:id", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const usedInDefaults = await db
      .select({ id: costCodeDefaults.id })
      .from(costCodeDefaults)
      .where(eq(costCodeDefaults.costCodeId, req.params.id))
      .limit(1);

    const usedInJobs = await db
      .select({ id: jobCostCodes.id })
      .from(jobCostCodes)
      .where(eq(jobCostCodes.costCodeId, req.params.id))
      .limit(1);

    if (usedInDefaults.length > 0 || usedInJobs.length > 0) {
      const [result] = await db
        .update(costCodes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
        .returning();

      return res.json({ ...result, deactivated: true, message: "Cost code is in use and has been deactivated instead of deleted" });
    }

    const [deleted] = await db
      .delete(costCodes)
      .where(and(eq(costCodes.id, req.params.id), eq(costCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Cost code not found" });
    }
    res.json({ message: "Cost code deleted", id: deleted.id });
  } catch (error: any) {
    logger.error("Error deleting cost code:", error);
    res.status(500).json({ message: "Failed to delete cost code" });
  }
});

router.get("/api/cost-code-defaults/:jobTypeId", requireAuth, requirePermission("admin_cost_codes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, req.params.jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: any) {
    logger.error("Error fetching cost code defaults:", error);
    res.status(500).json({ message: "Failed to fetch cost code defaults" });
  }
});

router.post("/api/cost-code-defaults", requireAuth, requirePermission("admin_cost_codes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobTypeId, costCodeIds } = z.object({
      jobTypeId: z.string().min(1),
      costCodeIds: z.array(z.string().min(1)),
    }).parse(req.body);

    await db.delete(costCodeDefaults).where(
      and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId))
    );

    if (costCodeIds.length > 0) {
      await db.insert(costCodeDefaults).values(
        costCodeIds.map((costCodeId) => ({
          companyId,
          jobTypeId,
          costCodeId,
        }))
      );
    }

    const results = await db
      .select({
        id: costCodeDefaults.id,
        jobTypeId: costCodeDefaults.jobTypeId,
        costCodeId: costCodeDefaults.costCodeId,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
      })
      .from(costCodeDefaults)
      .innerJoin(costCodes, eq(costCodeDefaults.costCodeId, costCodes.id))
      .where(and(eq(costCodeDefaults.jobTypeId, jobTypeId), eq(costCodeDefaults.companyId, companyId)))
      .orderBy(asc(costCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error saving cost code defaults:", error);
    res.status(500).json({ message: "Failed to save cost code defaults" });
  }
});

router.get("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, req.params.jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));

    res.json(results);
  } catch (error: any) {
    logger.error("Error fetching job cost codes:", error);
    res.status(500).json({ message: "Failed to fetch job cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes/inherit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [job] = await db
      .select({ id: jobs.id, jobTypeId: jobs.jobTypeId })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)));

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (!job.jobTypeId) {
      return res.status(400).json({ message: "Job has no job type set - cannot inherit cost codes" });
    }

    const defaults = await db
      .select({ costCodeId: costCodeDefaults.costCodeId })
      .from(costCodeDefaults)
      .where(and(eq(costCodeDefaults.jobTypeId, job.jobTypeId), eq(costCodeDefaults.companyId, companyId)));

    if (defaults.length === 0) {
      return res.status(400).json({ message: "No default cost codes defined for this job type" });
    }

    const existing = await db
      .select({ costCodeId: jobCostCodes.costCodeId })
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)));

    const existingSet = new Set(existing.map((e) => e.costCodeId));
    const newCodes = defaults.filter((d) => !existingSet.has(d.costCodeId));

    if (newCodes.length > 0) {
      await db.insert(jobCostCodes).values(
        newCodes.map((d, idx) => ({
          companyId,
          jobId,
          costCodeId: d.costCodeId,
          sortOrder: existing.length + idx,
        }))
      );
    }

    const results = await db
      .select({
        id: jobCostCodes.id,
        jobId: jobCostCodes.jobId,
        costCodeId: jobCostCodes.costCodeId,
        isDisabled: jobCostCodes.isDisabled,
        customName: jobCostCodes.customName,
        sortOrder: jobCostCodes.sortOrder,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        costCodeDescription: costCodes.description,
        isActive: costCodes.isActive,
      })
      .from(jobCostCodes)
      .innerJoin(costCodes, eq(jobCostCodes.costCodeId, costCodes.id))
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.companyId, companyId)))
      .orderBy(asc(jobCostCodes.sortOrder), asc(costCodes.code));

    res.json({ inherited: newCodes.length, total: results.length, costCodes: results });
  } catch (error: any) {
    logger.error("Error inheriting cost codes:", error);
    res.status(500).json({ message: "Failed to inherit cost codes" });
  }
});

router.post("/api/jobs/:jobId/cost-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const { costCodeId, customName, sortOrder } = z.object({
      costCodeId: z.string().min(1),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const existing = await db
      .select()
      .from(jobCostCodes)
      .where(and(eq(jobCostCodes.jobId, jobId), eq(jobCostCodes.costCodeId, costCodeId)));

    if (existing.length > 0) {
      return res.status(409).json({ message: "Cost code already assigned to this job" });
    }

    const [result] = await db
      .insert(jobCostCodes)
      .values({
        companyId,
        jobId,
        costCodeId,
        customName: customName || null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error adding job cost code:", error);
    res.status(500).json({ message: "Failed to add job cost code" });
  }
});

router.patch("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = z.object({
      isDisabled: z.boolean().optional(),
      customName: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body);

    const [result] = await db
      .update(jobCostCodes)
      .set(data)
      .where(and(eq(jobCostCodes.id, req.params.id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error("Error updating job cost code:", error);
    res.status(500).json({ message: "Failed to update job cost code" });
  }
});

router.delete("/api/jobs/:jobId/cost-codes/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const [deleted] = await db
      .delete(jobCostCodes)
      .where(and(eq(jobCostCodes.id, req.params.id), eq(jobCostCodes.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Job cost code not found" });
    }
    res.json({ message: "Job cost code removed", id: deleted.id });
  } catch (error: any) {
    logger.error("Error removing job cost code:", error);
    res.status(500).json({ message: "Failed to remove job cost code" });
  }
});

export const costCodesRouter = router;
