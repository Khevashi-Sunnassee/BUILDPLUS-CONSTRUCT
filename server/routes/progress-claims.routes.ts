import { Router, Request, Response } from "express";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import {
  progressClaims,
  progressClaimItems,
  panelRegister,
  jobs,
  contracts,
  panelTypes,
  jobPanelRates,
  users,
  PANEL_LIFECYCLE_STATUS,
} from "@shared/schema";
import { eq, and, sql, desc, count, inArray } from "drizzle-orm";
import logger from "../lib/logger";

const router = Router();

router.get("/api/progress-claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const status = req.query.status as string | undefined;
    const jobId = req.query.jobId as string | undefined;

    let conditions = [eq(progressClaims.companyId, companyId)];
    if (status) conditions.push(eq(progressClaims.status, status as any));
    if (jobId) conditions.push(eq(progressClaims.jobId, jobId));

    const claims = await db
      .select({
        id: progressClaims.id,
        companyId: progressClaims.companyId,
        jobId: progressClaims.jobId,
        claimNumber: progressClaims.claimNumber,
        status: progressClaims.status,
        claimDate: progressClaims.claimDate,
        claimType: progressClaims.claimType,
        subtotal: progressClaims.subtotal,
        taxRate: progressClaims.taxRate,
        taxAmount: progressClaims.taxAmount,
        total: progressClaims.total,
        notes: progressClaims.notes,
        internalNotes: progressClaims.internalNotes,
        createdById: progressClaims.createdById,
        approvedById: progressClaims.approvedById,
        approvedAt: progressClaims.approvedAt,
        rejectedById: progressClaims.rejectedById,
        rejectedAt: progressClaims.rejectedAt,
        rejectionReason: progressClaims.rejectionReason,
        submittedAt: progressClaims.submittedAt,
        createdAt: progressClaims.createdAt,
        updatedAt: progressClaims.updatedAt,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
        createdByName: users.fullName,
      })
      .from(progressClaims)
      .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
      .leftJoin(users, eq(progressClaims.createdById, users.id))
      .where(and(...conditions))
      .orderBy(desc(progressClaims.createdAt));

    const uniqueJobIds = [...new Set(claims.map(c => c.jobId))];

    const claimedToDateByJob: Record<string, number> = {};
    const contractValueByJob: Record<string, number> = {};

    if (uniqueJobIds.length > 0) {
      const [approvedClaimTotals, allPT] = await Promise.all([
        db
          .select({
            jobId: progressClaims.jobId,
            totalApproved: sql<string>`COALESCE(SUM(CAST(${progressClaims.subtotal} AS DECIMAL)), 0)`,
          })
          .from(progressClaims)
          .where(and(
            eq(progressClaims.companyId, companyId),
            eq(progressClaims.status, "APPROVED"),
            inArray(progressClaims.jobId, uniqueJobIds),
          ))
          .groupBy(progressClaims.jobId),
        db.select().from(panelTypes).where(eq(panelTypes.companyId, companyId)),
      ]);

      for (const row of approvedClaimTotals) {
        claimedToDateByJob[row.jobId] = parseFloat(row.totalApproved || "0");
      }

      const ptMap = new Map(allPT.map(pt => [pt.code, pt]));

      await Promise.all(uniqueJobIds.map(async (jId) => {
        const [panels, allJR] = await Promise.all([
          db
            .select({
              panelType: panelRegister.panelType,
              panelArea: panelRegister.panelArea,
              panelVolume: panelRegister.panelVolume,
            })
            .from(panelRegister)
            .where(and(eq(panelRegister.jobId, jId), eq(panelRegister.companyId, companyId))),
          db.select().from(jobPanelRates).where(eq(jobPanelRates.jobId, jId)),
        ]);

        const jrMap = new Map(allJR.map(jr => [jr.panelTypeId, jr]));
        let totalValue = 0;
        for (const panel of panels) {
          const pt = ptMap.get(panel.panelType);
          const ptId = pt?.id;
          const jr = ptId ? jrMap.get(ptId) : null;
          const sellRateM2 = parseFloat(jr?.sellRatePerM2 || pt?.sellRatePerM2 || "0");
          const sellRateM3 = parseFloat(jr?.sellRatePerM3 || pt?.sellRatePerM3 || "0");
          const area = parseFloat(panel.panelArea || "0");
          const volume = parseFloat(panel.panelVolume || "0");
          if (sellRateM2 > 0 && area > 0) totalValue += sellRateM2 * area;
          else if (sellRateM3 > 0 && volume > 0) totalValue += sellRateM3 * volume;
        }
        contractValueByJob[jId] = totalValue;
      }));
    }

    const enrichedClaims = claims.map(claim => {
      const claimedToDate = claimedToDateByJob[claim.jobId] || 0;
      const contractValue = contractValueByJob[claim.jobId] || 0;
      const remaining = contractValue - claimedToDate;
      return {
        ...claim,
        contractValue: contractValue.toFixed(2),
        claimedToDate: claimedToDate.toFixed(2),
        remainingValue: remaining.toFixed(2),
      };
    });

    res.json(enrichedClaims);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching progress claims");
    res.status(500).json({ error: error.message || "Failed to fetch progress claims" });
  }
});

router.get("/api/progress-claims/next-number", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const result = await db
      .select({ cnt: count() })
      .from(progressClaims)
      .where(eq(progressClaims.companyId, companyId));
    const nextNum = (result[0]?.cnt || 0) + 1;
    res.json({ claimNumber: `PC-${String(nextNum).padStart(4, "0")}` });
  } catch (error: any) {
    logger.error({ err: error }, "Error getting next claim number");
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [claim] = await db
      .select({
        id: progressClaims.id,
        companyId: progressClaims.companyId,
        jobId: progressClaims.jobId,
        claimNumber: progressClaims.claimNumber,
        status: progressClaims.status,
        claimDate: progressClaims.claimDate,
        claimType: progressClaims.claimType,
        subtotal: progressClaims.subtotal,
        taxRate: progressClaims.taxRate,
        taxAmount: progressClaims.taxAmount,
        total: progressClaims.total,
        notes: progressClaims.notes,
        internalNotes: progressClaims.internalNotes,
        createdById: progressClaims.createdById,
        approvedById: progressClaims.approvedById,
        approvedAt: progressClaims.approvedAt,
        rejectedById: progressClaims.rejectedById,
        rejectedAt: progressClaims.rejectedAt,
        rejectionReason: progressClaims.rejectionReason,
        submittedAt: progressClaims.submittedAt,
        createdAt: progressClaims.createdAt,
        updatedAt: progressClaims.updatedAt,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
      })
      .from(progressClaims)
      .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));

    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    res.json(claim);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching progress claim");
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/progress-claims/:id/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [claim] = await db
      .select()
      .from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });

    const items = await db
      .select({
        id: progressClaimItems.id,
        progressClaimId: progressClaimItems.progressClaimId,
        panelId: progressClaimItems.panelId,
        panelMark: progressClaimItems.panelMark,
        level: progressClaimItems.level,
        panelRevenue: progressClaimItems.panelRevenue,
        percentComplete: progressClaimItems.percentComplete,
        lineTotal: progressClaimItems.lineTotal,
        lifecycleStatus: panelRegister.lifecycleStatus,
      })
      .from(progressClaimItems)
      .leftJoin(panelRegister, eq(progressClaimItems.panelId, panelRegister.id))
      .where(eq(progressClaimItems.progressClaimId, req.params.id));

    res.json(items);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching claim items");
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/progress-claims/job/:jobId/claimable-panels", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, jobId), eq(contracts.companyId, companyId)));

    const claimableAtPhase = contract?.claimableAtPhase ?? PANEL_LIFECYCLE_STATUS.PRODUCED;

    const panels = await db
      .select({
        id: panelRegister.id,
        panelMark: panelRegister.panelMark,
        level: panelRegister.level,
        panelType: panelRegister.panelType,
        lifecycleStatus: panelRegister.lifecycleStatus,
        panelArea: panelRegister.panelArea,
        panelVolume: panelRegister.panelVolume,
        building: panelRegister.building,
        description: panelRegister.description,
      })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.jobId, jobId),
        eq(panelRegister.companyId, companyId),
      ));

    const allPanelTypes = await db
      .select()
      .from(panelTypes)
      .where(eq(panelTypes.companyId, companyId));

    const allJobRates = await db
      .select()
      .from(jobPanelRates)
      .where(eq(jobPanelRates.jobId, jobId));

    const panelTypeMap = new Map(allPanelTypes.map(pt => [pt.code, pt]));
    const jobRateMap = new Map(allJobRates.map(jr => [jr.panelTypeId, jr]));

    const alreadyClaimedPanelIds = await db
      .select({ panelId: progressClaimItems.panelId })
      .from(progressClaimItems)
      .innerJoin(progressClaims, eq(progressClaimItems.progressClaimId, progressClaims.id))
      .where(and(
        eq(progressClaims.jobId, jobId),
        eq(progressClaims.companyId, companyId),
        inArray(progressClaims.status, ["APPROVED"]),
      ));

    const claimedSet = new Set(alreadyClaimedPanelIds.map(r => r.panelId));

    const panelsWithRevenue = panels.map(panel => {
      const pt = panelTypeMap.get(panel.panelType);
      const ptId = pt?.id;
      const jobRate = ptId ? jobRateMap.get(ptId) : null;

      const sellRateM2 = parseFloat(jobRate?.sellRatePerM2 || pt?.sellRatePerM2 || "0");
      const sellRateM3 = parseFloat(jobRate?.sellRatePerM3 || pt?.sellRatePerM3 || "0");
      const area = parseFloat(panel.panelArea || "0");
      const volume = parseFloat(panel.panelVolume || "0");

      let revenue = 0;
      if (sellRateM2 > 0 && area > 0) {
        revenue = sellRateM2 * area;
      } else if (sellRateM3 > 0 && volume > 0) {
        revenue = sellRateM3 * volume;
      }

      const isClaimed = panel.lifecycleStatus === PANEL_LIFECYCLE_STATUS.CLAIMED || claimedSet.has(panel.id);
      const hasReachedPhase = panel.lifecycleStatus >= claimableAtPhase;
      const autoPercent = hasReachedPhase && !isClaimed ? 100 : 0;

      return {
        ...panel,
        revenue: revenue.toFixed(2),
        isClaimed,
        hasReachedPhase,
        autoPercent,
        claimableAtPhase,
      };
    });

    res.json(panelsWithRevenue);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching claimable panels");
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/progress-claims/job/:jobId/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;

    const approvedTotals = await db
      .select({
        totalApproved: sql<string>`COALESCE(SUM(CAST(${progressClaims.subtotal} AS DECIMAL)), 0)`,
      })
      .from(progressClaims)
      .where(and(
        eq(progressClaims.companyId, companyId),
        eq(progressClaims.jobId, jobId),
        eq(progressClaims.status, "APPROVED"),
      ));

    const claimedToDate = parseFloat(approvedTotals[0]?.totalApproved || "0");

    const panels = await db
      .select({
        panelType: panelRegister.panelType,
        panelArea: panelRegister.panelArea,
        panelVolume: panelRegister.panelVolume,
      })
      .from(panelRegister)
      .where(and(eq(panelRegister.jobId, jobId), eq(panelRegister.companyId, companyId)));

    const allPT = await db.select().from(panelTypes).where(eq(panelTypes.companyId, companyId));
    const allJR = await db.select().from(jobPanelRates).where(eq(jobPanelRates.jobId, jobId));
    const ptMap = new Map(allPT.map(pt => [pt.code, pt]));
    const jrMap = new Map(allJR.map(jr => [jr.panelTypeId, jr]));

    let contractValue = 0;
    for (const panel of panels) {
      const pt = ptMap.get(panel.panelType);
      const ptId = pt?.id;
      const jr = ptId ? jrMap.get(ptId) : null;
      const sellRateM2 = parseFloat(jr?.sellRatePerM2 || pt?.sellRatePerM2 || "0");
      const sellRateM3 = parseFloat(jr?.sellRatePerM3 || pt?.sellRatePerM3 || "0");
      const area = parseFloat(panel.panelArea || "0");
      const volume = parseFloat(panel.panelVolume || "0");
      if (sellRateM2 > 0 && area > 0) contractValue += sellRateM2 * area;
      else if (sellRateM3 > 0 && volume > 0) contractValue += sellRateM3 * volume;
    }

    const remaining = contractValue - claimedToDate;

    res.json({
      contractValue: contractValue.toFixed(2),
      claimedToDate: claimedToDate.toFixed(2),
      remainingValue: remaining.toFixed(2),
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching job claim summary");
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/progress-claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const { items: claimItems, ...claimData } = req.body;

    const result = await db
      .select({ cnt: count() })
      .from(progressClaims)
      .where(eq(progressClaims.companyId, companyId));
    const nextNum = (result[0]?.cnt || 0) + 1;
    const claimNumber = `PC-${String(nextNum).padStart(4, "0")}`;

    const [claim] = await db.insert(progressClaims).values({
      companyId,
      jobId: claimData.jobId,
      claimNumber,
      claimDate: claimData.claimDate ? new Date(claimData.claimDate) : new Date(),
      claimType: claimData.claimType || "DETAIL",
      notes: claimData.notes,
      internalNotes: claimData.internalNotes,
      createdById: userId,
      subtotal: "0",
      taxAmount: "0",
      total: "0",
    }).returning();

    if (claimItems && claimItems.length > 0) {
      const validItems = claimItems.filter((item: any) => parseFloat(item.percentComplete || "0") > 0);
      if (validItems.length > 0) {
        await db.insert(progressClaimItems).values(
          validItems.map((item: any) => {
            const revenue = parseFloat(item.panelRevenue || "0");
            const pct = parseFloat(item.percentComplete || "0");
            const lineTotal = (revenue * pct / 100).toFixed(2);
            return {
              progressClaimId: claim.id,
              panelId: item.panelId,
              panelMark: item.panelMark,
              level: item.level || null,
              panelRevenue: String(revenue.toFixed(2)),
              percentComplete: String(pct.toFixed(2)),
              lineTotal,
            };
          })
        );
      }

      const subtotal = validItems.reduce((sum: number, item: any) => {
        const revenue = parseFloat(item.panelRevenue || "0");
        const pct = parseFloat(item.percentComplete || "0");
        return sum + (revenue * pct / 100);
      }, 0);
      const taxRate = parseFloat(claimData.taxRate || "10");
      const taxAmount = subtotal * taxRate / 100;
      const total = subtotal + taxAmount;

      await db.update(progressClaims)
        .set({
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: total.toFixed(2),
          taxRate: String(taxRate),
          updatedAt: new Date(),
        })
        .where(eq(progressClaims.id, claim.id));
    }

    const [updated] = await db.select().from(progressClaims).where(eq(progressClaims.id, claim.id));
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating progress claim");
    res.status(500).json({ error: error.message || "Failed to create progress claim" });
  }
});

router.patch("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "DRAFT") return res.status(400).json({ error: "Only draft claims can be edited" });

    const { items: claimItems, ...claimData } = req.body;

    if (claimItems !== undefined) {
      await db.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, claim.id));

      const validItems = (claimItems || []).filter((item: any) => parseFloat(item.percentComplete || "0") > 0);
      if (validItems.length > 0) {
        await db.insert(progressClaimItems).values(
          validItems.map((item: any) => {
            const revenue = parseFloat(item.panelRevenue || "0");
            const pct = parseFloat(item.percentComplete || "0");
            const lineTotal = (revenue * pct / 100).toFixed(2);
            return {
              progressClaimId: claim.id,
              panelId: item.panelId,
              panelMark: item.panelMark,
              level: item.level || null,
              panelRevenue: String(revenue.toFixed(2)),
              percentComplete: String(pct.toFixed(2)),
              lineTotal,
            };
          })
        );
      }

      const subtotal = validItems.reduce((sum: number, item: any) => {
        const revenue = parseFloat(item.panelRevenue || "0");
        const pct = parseFloat(item.percentComplete || "0");
        return sum + (revenue * pct / 100);
      }, 0);
      const taxRate = parseFloat(claimData.taxRate || claim.taxRate || "10");
      const taxAmount = subtotal * taxRate / 100;
      const total = subtotal + taxAmount;

      claimData.subtotal = subtotal.toFixed(2);
      claimData.taxAmount = taxAmount.toFixed(2);
      claimData.total = total.toFixed(2);
      claimData.taxRate = String(taxRate);
    }

    const [updated] = await db.update(progressClaims)
      .set({ ...claimData, updatedAt: new Date() })
      .where(eq(progressClaims.id, claim.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating progress claim");
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/progress-claims/:id/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "DRAFT") return res.status(400).json({ error: "Only draft claims can be submitted" });

    const [updated] = await db.update(progressClaims)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(progressClaims.id, claim.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error submitting progress claim");
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/progress-claims/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted claims can be approved" });

    const [updated] = await db.update(progressClaims)
      .set({
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(progressClaims.id, claim.id))
      .returning();

    const items = await db.select().from(progressClaimItems)
      .where(eq(progressClaimItems.progressClaimId, claim.id));

    const fullClaimPanelIds = items
      .filter(item => parseFloat(item.percentComplete || "0") >= 100)
      .map(item => item.panelId);

    if (fullClaimPanelIds.length > 0) {
      await db.update(panelRegister)
        .set({ lifecycleStatus: PANEL_LIFECYCLE_STATUS.CLAIMED, updatedAt: new Date() })
        .where(inArray(panelRegister.id, fullClaimPanelIds));
    }

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error approving progress claim");
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/progress-claims/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted claims can be rejected" });

    const { reason } = req.body;
    const [updated] = await db.update(progressClaims)
      .set({
        status: "REJECTED",
        rejectedById: userId,
        rejectedAt: new Date(),
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(progressClaims.id, claim.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error rejecting progress claim");
    res.status(500).json({ error: error.message });
  }
});

router.delete("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, req.params.id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });

    if (claim.status === "APPROVED") {
      return res.status(400).json({ error: "Approved claims cannot be deleted" });
    }
    if (claim.createdById !== userId) {
      return res.status(403).json({ error: "Only the creator can delete this claim" });
    }

    await db.delete(progressClaims).where(eq(progressClaims.id, claim.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting progress claim");
    res.status(500).json({ error: error.message });
  }
});

export const progressClaimsRouter = router;
