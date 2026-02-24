import {
  Router,
  db,
  requireAuth,
  progressClaims,
  progressClaimItems,
  panelRegister,
  jobs,
  panelTypes,
  jobPanelRates,
  users,
  eq,
  and,
  sql,
  desc,
  count,
  inArray,
  logger,
  safeParseFinancial,
  calculateRetention,
  getPreviouslyClaimedPercents,
  validateClaimItemsPercent,
} from "./shared";
import type { Request, Response } from "express";

const router = Router();

router.get("/api/progress-claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const status = req.query.status as string | undefined;
    const jobId = req.query.jobId as string | undefined;

    let conditions = [eq(progressClaims.companyId, companyId)];
    if (status) conditions.push(eq(progressClaims.status, status as typeof progressClaims.status.enumValues[number]));
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
        retentionRate: progressClaims.retentionRate,
        retentionAmount: progressClaims.retentionAmount,
        retentionHeldToDate: progressClaims.retentionHeldToDate,
        netClaimAmount: progressClaims.netClaimAmount,
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
        createdByName: users.name,
      })
      .from(progressClaims)
      .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
      .leftJoin(users, eq(progressClaims.createdById, users.id))
      .where(and(...conditions))
      .orderBy(desc(progressClaims.createdAt))
      .limit(Math.min(parseInt(req.query.limit as string) || 500, 1000));

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
        db.select().from(panelTypes).where(eq(panelTypes.companyId, companyId)).limit(1000),
      ]);

      for (const row of approvedClaimTotals) {
        claimedToDateByJob[row.jobId] = safeParseFinancial(row.totalApproved, 0);
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
            .where(eq(panelRegister.jobId, jId))
            .limit(5000),
          db.select().from(jobPanelRates).where(eq(jobPanelRates.jobId, jId)).limit(1000),
        ]);

        const jrMap = new Map(allJR.map(jr => [jr.panelTypeId, jr]));
        let totalValue = 0;
        for (const panel of panels) {
          const pt = ptMap.get(panel.panelType);
          const ptId = pt?.id;
          const jr = ptId ? jrMap.get(ptId) : null;
          const sellRateM2 = safeParseFinancial(jr?.sellRatePerM2 || pt?.sellRatePerM2, 0);
          const sellRateM3 = safeParseFinancial(jr?.sellRatePerM3 || pt?.sellRatePerM3, 0);
          const area = safeParseFinancial(panel.panelArea, 0);
          const volume = safeParseFinancial(panel.panelVolume, 0);
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching progress claims");
    res.status(500).json({ error: "An internal error occurred" });
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error getting next claim number");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
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
        retentionRate: progressClaims.retentionRate,
        retentionAmount: progressClaims.retentionAmount,
        retentionHeldToDate: progressClaims.retentionHeldToDate,
        netClaimAmount: progressClaims.netClaimAmount,
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
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));

    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    res.json(claim);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/progress-claims/:id/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const [claim] = await db
      .select()
      .from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });

    const safeLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
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
      .where(eq(progressClaimItems.progressClaimId, id))
      .limit(safeLimit);

    res.json(items);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching claim items");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/progress-claims", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const { items: claimItems, ...claimData } = req.body;

    if (claimItems && claimItems.length > 0) {
      const previousPercents = await getPreviouslyClaimedPercents(companyId, claimData.jobId);
      const validation = validateClaimItemsPercent(claimItems, previousPercents);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Claim exceeds previously claimed amounts",
          details: validation.errors,
        });
      }
    }

    const result = await db
      .select({ cnt: count() })
      .from(progressClaims)
      .where(eq(progressClaims.companyId, companyId));
    const nextNum = (result[0]?.cnt || 0) + 1;
    const claimNumber = `PC-${String(nextNum).padStart(4, "0")}`;

    const updated = await db.transaction(async (tx) => {
      const [claim] = await tx.insert(progressClaims).values({
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
        const validItems = claimItems.filter((item: Record<string, unknown>) => safeParseFinancial(item.percentComplete as string | null | undefined, 0) > 0);
        if (validItems.length > 0) {
          await tx.insert(progressClaimItems).values(
            validItems.map((item: Record<string, unknown>) => {
              const revenue = safeParseFinancial(item.panelRevenue as string | null | undefined, 0);
              const pct = safeParseFinancial(item.percentComplete as string | null | undefined, 0);
              const lineTotal = (revenue * pct / 100).toFixed(2);
              return {
                progressClaimId: claim.id,
                panelId: item.panelId,
                panelMark: item.panelMark as string | null | undefined,
                level: item.level as string | null | undefined || null,
                panelRevenue: String(revenue.toFixed(2)),
                percentComplete: String(pct.toFixed(2)),
                lineTotal,
              };
            })
          );
        }

        const subtotal = validItems.reduce((sum: number, item: Record<string, unknown>) => {
          const revenue = safeParseFinancial(item.panelRevenue as string | null | undefined, 0);
          const pct = safeParseFinancial(item.percentComplete as string | null | undefined, 0);
          return sum + (revenue * pct / 100);
        }, 0);
        const taxRate = safeParseFinancial(claimData.taxRate, 10);
        const taxAmount = subtotal * taxRate / 100;
        const total = subtotal + taxAmount;

        const retention = await calculateRetention(companyId, claimData.jobId, subtotal, claim.id);
        const netClaimAmount = total - retention.retentionAmount;

        await tx.update(progressClaims)
          .set({
            subtotal: subtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            total: total.toFixed(2),
            taxRate: String(taxRate),
            retentionRate: String(retention.retentionRate),
            retentionAmount: retention.retentionAmount.toFixed(2),
            retentionHeldToDate: retention.retentionHeldToDate.toFixed(2),
            netClaimAmount: netClaimAmount.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(progressClaims.id, claim.id));
      }

      const [result] = await tx.select().from(progressClaims).where(eq(progressClaims.id, claim.id));
      return result;
    });
    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.patch("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "DRAFT") return res.status(400).json({ error: "Only draft claims can be edited" });

    const { items: claimItems, version: clientVersion, ...claimData } = req.body;

    if (claimItems !== undefined && claimItems.length > 0) {
      const previousPercents = await getPreviouslyClaimedPercents(companyId, claim.jobId, claim.id);
      const validation = validateClaimItemsPercent(claimItems, previousPercents);
      if (!validation.valid) {
        return res.status(400).json({
          error: "Claim exceeds previously claimed amounts",
          details: validation.errors,
        });
      }
    }

    if (claimItems !== undefined) {
      const validItems = (claimItems || []).filter((item: Record<string, unknown>) => safeParseFinancial(item.percentComplete as string | null | undefined, 0) > 0);
      const subtotal = validItems.reduce((sum: number, item: Record<string, unknown>) => {
        const revenue = safeParseFinancial(item.panelRevenue as string | null | undefined, 0);
        const pct = safeParseFinancial(item.percentComplete as string | null | undefined, 0);
        return sum + (revenue * pct / 100);
      }, 0);
      const taxRate = safeParseFinancial(claimData.taxRate || claim.taxRate, 10);
      const taxAmount = subtotal * taxRate / 100;
      const total = subtotal + taxAmount;

      const retentionResult = await calculateRetention(companyId, claim.jobId, subtotal, claim.id);
      const netClaimAmount = total - retentionResult.retentionAmount;

      claimData.subtotal = subtotal.toFixed(2);
      claimData.taxAmount = taxAmount.toFixed(2);
      claimData.total = total.toFixed(2);
      claimData.taxRate = String(taxRate);
      claimData.retentionRate = String(retentionResult.retentionRate);
      claimData.retentionAmount = retentionResult.retentionAmount.toFixed(2);
      claimData.retentionHeldToDate = retentionResult.retentionHeldToDate.toFixed(2);
      claimData.netClaimAmount = netClaimAmount.toFixed(2);

      const [updated] = await db.transaction(async (tx) => {
        const versionWhere = clientVersion !== undefined
          ? and(eq(progressClaims.id, claim.id), eq(progressClaims.version, clientVersion))
          : eq(progressClaims.id, claim.id);

        await tx.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, claim.id));

        if (validItems.length > 0) {
          await tx.insert(progressClaimItems).values(
            validItems.map((item: Record<string, unknown>) => {
              const revenue = safeParseFinancial(item.panelRevenue as string | null | undefined, 0);
              const pct = safeParseFinancial(item.percentComplete as string | null | undefined, 0);
              const lineTotal = (revenue * pct / 100).toFixed(2);
              return {
                progressClaimId: claim.id,
                panelId: item.panelId,
                panelMark: item.panelMark as string | null | undefined,
                level: item.level as string | null | undefined || null,
                panelRevenue: String(revenue.toFixed(2)),
                percentComplete: String(pct.toFixed(2)),
                lineTotal,
              };
            })
          );
        }

        const result = await tx.update(progressClaims)
          .set({ ...claimData, updatedAt: new Date(), version: sql`${progressClaims.version} + 1` })
          .where(versionWhere)
          .returning();

        if (result.length === 0) {
          throw Object.assign(new Error("Claim was modified by another user. Please refresh and try again."), { statusCode: 409 });
        }
        return result;
      });

      res.json(updated);
      return;
    }

    const versionWhere = clientVersion !== undefined
      ? and(eq(progressClaims.id, claim.id), eq(progressClaims.version, clientVersion))
      : eq(progressClaims.id, claim.id);
    const [updated] = await db.update(progressClaims)
      .set({ ...claimData, updatedAt: new Date(), version: sql`${progressClaims.version} + 1` })
      .where(versionWhere)
      .returning();

    if (!updated && clientVersion !== undefined) {
      return res.status(409).json({ error: "Claim was modified by another user. Please refresh and try again." });
    }

    res.json(updated);
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 409) {
      return res.status(409).json({ error: "An internal error occurred" });
    }
    logger.error({ err: error }, "Error updating progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/progress-claims/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });

    if (claim.status === "APPROVED") {
      return res.status(400).json({ error: "Approved claims cannot be deleted" });
    }
    if (claim.createdById !== userId) {
      return res.status(403).json({ error: "Only the creator can delete this claim" });
    }

    await db.transaction(async (tx) => {
      await tx.delete(progressClaimItems).where(eq(progressClaimItems.progressClaimId, claim.id));
      await tx.delete(progressClaims).where(eq(progressClaims.id, claim.id));
    });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
