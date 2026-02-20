import {
  Router,
  db,
  requireAuth,
  progressClaims,
  progressClaimItems,
  panelRegister,
  jobs,
  contracts,
  panelTypes,
  jobPanelRates,
  PANEL_LIFECYCLE_STATUS,
  eq,
  and,
  sql,
  inArray,
  logger,
  safeParseFinancial,
} from "./shared";
import type { Request, Response } from "express";

const router = Router();

router.get("/api/progress-claims/retention-report", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const allClaims = await db
      .select({
        id: progressClaims.id,
        jobId: progressClaims.jobId,
        claimNumber: progressClaims.claimNumber,
        status: progressClaims.status,
        claimDate: progressClaims.claimDate,
        subtotal: progressClaims.subtotal,
        total: progressClaims.total,
        retentionRate: progressClaims.retentionRate,
        retentionAmount: progressClaims.retentionAmount,
        retentionHeldToDate: progressClaims.retentionHeldToDate,
        netClaimAmount: progressClaims.netClaimAmount,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
      })
      .from(progressClaims)
      .leftJoin(jobs, eq(progressClaims.jobId, jobs.id))
      .where(eq(progressClaims.companyId, companyId))
      .orderBy(jobs.jobNumber, progressClaims.claimDate)
      .limit(Math.min(parseInt(req.query.limit as string) || 500, 1000));

    const jobIds = [...new Set(allClaims.map(c => c.jobId))];
    const contractMap: Record<string, { retentionRate: number; retentionCapPct: number; contractValue: number; retentionCapAmount: number }> = {};

    if (jobIds.length > 0) {
      const allContracts = await db
        .select({
          jobId: contracts.jobId,
          retentionPercentage: contracts.retentionPercentage,
          retentionCap: contracts.retentionCap,
          originalContractValue: contracts.originalContractValue,
          revisedContractValue: contracts.revisedContractValue,
        })
        .from(contracts)
        .where(and(eq(contracts.companyId, companyId), inArray(contracts.jobId, jobIds)))
        .limit(1000);

      for (const c of allContracts) {
        const rate = safeParseFinancial(c.retentionPercentage as string | null | undefined, 10);
        const capPct = safeParseFinancial(c.retentionCap as string | null | undefined, 5);
        const cv = safeParseFinancial((c.revisedContractValue || c.originalContractValue) as string | null | undefined, 0);
        contractMap[c.jobId] = {
          retentionRate: rate,
          retentionCapPct: capPct,
          contractValue: cv,
          retentionCapAmount: cv > 0 ? cv * capPct / 100 : 0,
        };
      }
    }

    const jobGroups: Record<string, { jobId: string; jobNumber: string; jobName: string; contractValue: string; retentionRate: number; retentionCapPct: number; retentionCapAmount: string; totalRetentionHeld: string; remainingRetention?: string; claims: Array<Record<string, unknown>> }> = {};
    for (const claim of allClaims) {
      if (!jobGroups[claim.jobId]) {
        const ci = contractMap[claim.jobId] || { retentionRate: 10, retentionCapPct: 5, contractValue: 0, retentionCapAmount: 0 };
        jobGroups[claim.jobId] = {
          jobId: claim.jobId,
          jobNumber: claim.jobNumber || "",
          jobName: claim.jobName || "",
          contractValue: ci.contractValue.toFixed(2),
          retentionRate: ci.retentionRate,
          retentionCapPct: ci.retentionCapPct,
          retentionCapAmount: ci.retentionCapAmount.toFixed(2),
          totalRetentionHeld: "0",
          claims: [],
        };
      }
      jobGroups[claim.jobId].claims.push(claim);
    }

    for (const group of Object.values(jobGroups)) {
      let running = 0;
      for (const claim of group.claims) {
        running += safeParseFinancial(claim.retentionAmount as string | null | undefined, 0);
        claim.cumulativeRetention = running.toFixed(2);
      }
      group.totalRetentionHeld = running.toFixed(2);
      const ci = contractMap[group.jobId];
      group.remainingRetention = ci ? Math.max(0, ci.retentionCapAmount - running).toFixed(2) : "0";
    }

    res.json(Object.values(jobGroups));
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching retention report");
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.get("/api/progress-claims/job/:jobId/claimable-panels", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = String(req.params.jobId);

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
      .where(eq(panelRegister.jobId, jobId))
      .limit(5000);

    const allPanelTypes = await db
      .select()
      .from(panelTypes)
      .where(eq(panelTypes.companyId, companyId))
      .limit(1000);

    const allJobRates = await db
      .select()
      .from(jobPanelRates)
      .where(eq(jobPanelRates.jobId, jobId))
      .limit(1000);

    const panelTypeMap = new Map(allPanelTypes.map(pt => [pt.code, pt]));
    const jobRateMap = new Map(allJobRates.map(jr => [jr.panelTypeId, jr]));

    const excludeClaimId = req.query.excludeClaimId as string | undefined;

    let claimConditions = [
      eq(progressClaims.jobId, jobId),
      eq(progressClaims.companyId, companyId),
      inArray(progressClaims.status, ["APPROVED"]),
    ];
    if (excludeClaimId) {
      claimConditions.push(sql`${progressClaims.id} != ${excludeClaimId}`);
    }

    const previousClaimItems = await db
      .select({
        panelId: progressClaimItems.panelId,
        percentComplete: progressClaimItems.percentComplete,
        lineTotal: progressClaimItems.lineTotal,
      })
      .from(progressClaimItems)
      .innerJoin(progressClaims, eq(progressClaimItems.progressClaimId, progressClaims.id))
      .where(and(...claimConditions))
      .limit(5000);

    const claimedPercentByPanel = new Map<string, number>();
    const claimedAmountByPanel = new Map<string, number>();
    for (const item of previousClaimItems) {
      const prev = claimedPercentByPanel.get(item.panelId) || 0;
      claimedPercentByPanel.set(item.panelId, prev + safeParseFinancial(item.percentComplete, 0));
      const prevAmt = claimedAmountByPanel.get(item.panelId) || 0;
      claimedAmountByPanel.set(item.panelId, prevAmt + safeParseFinancial(item.lineTotal, 0));
    }

    const panelsWithRevenue = panels.map(panel => {
      const pt = panelTypeMap.get(panel.panelType);
      const ptId = pt?.id;
      const jobRate = ptId ? jobRateMap.get(ptId) : null;

      const sellRateM2 = safeParseFinancial(jobRate?.sellRatePerM2 || pt?.sellRatePerM2, 0);
      const sellRateM3 = safeParseFinancial(jobRate?.sellRatePerM3 || pt?.sellRatePerM3, 0);
      const area = safeParseFinancial(panel.panelArea, 0);
      const volume = safeParseFinancial(panel.panelVolume, 0);

      let revenue = 0;
      if (sellRateM2 > 0 && area > 0) {
        revenue = sellRateM2 * area;
      } else if (sellRateM3 > 0 && volume > 0) {
        revenue = sellRateM3 * volume;
      }

      const previouslyClaimedPercent = claimedPercentByPanel.get(panel.id) || 0;
      const previouslyClaimedAmount = claimedAmountByPanel.get(panel.id) || 0;
      const remainingClaimablePercent = Math.max(0, 100 - previouslyClaimedPercent);
      const isClaimed = panel.lifecycleStatus === PANEL_LIFECYCLE_STATUS.CLAIMED || previouslyClaimedPercent >= 100;
      const hasReachedPhase = panel.lifecycleStatus >= claimableAtPhase;
      const autoPercent = hasReachedPhase && !isClaimed ? remainingClaimablePercent : 0;

      return {
        ...panel,
        revenue: revenue.toFixed(2),
        isClaimed,
        hasReachedPhase,
        autoPercent,
        previouslyClaimedPercent: parseFloat(previouslyClaimedPercent.toFixed(2)),
        previouslyClaimedAmount: previouslyClaimedAmount.toFixed(2),
        remainingClaimablePercent: parseFloat(remainingClaimablePercent.toFixed(2)),
        claimableAtPhase,
      };
    });

    res.json(panelsWithRevenue);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching claimable panels");
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.get("/api/progress-claims/job/:jobId/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = String(req.params.jobId);

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

    const claimedToDate = safeParseFinancial(approvedTotals[0]?.totalApproved, 0);

    const panels = await db
      .select({
        panelType: panelRegister.panelType,
        panelArea: panelRegister.panelArea,
        panelVolume: panelRegister.panelVolume,
      })
      .from(panelRegister)
      .where(eq(panelRegister.jobId, jobId))
      .limit(5000);

    const allPT = await db.select().from(panelTypes).where(eq(panelTypes.companyId, companyId)).limit(1000);
    const allJR = await db.select().from(jobPanelRates).where(eq(jobPanelRates.jobId, jobId)).limit(1000);
    const ptMap = new Map(allPT.map(pt => [pt.code, pt]));
    const jrMap = new Map(allJR.map(jr => [jr.panelTypeId, jr]));

    let contractValue = 0;
    for (const panel of panels) {
      const pt = ptMap.get(panel.panelType);
      const ptId = pt?.id;
      const jr = ptId ? jrMap.get(ptId) : null;
      const sellRateM2 = safeParseFinancial(jr?.sellRatePerM2 || pt?.sellRatePerM2, 0);
      const sellRateM3 = safeParseFinancial(jr?.sellRatePerM3 || pt?.sellRatePerM3, 0);
      const area = safeParseFinancial(panel.panelArea, 0);
      const volume = safeParseFinancial(panel.panelVolume, 0);
      if (sellRateM2 > 0 && area > 0) contractValue += sellRateM2 * area;
      else if (sellRateM3 > 0 && volume > 0) contractValue += sellRateM3 * volume;
    }

    const remaining = contractValue - claimedToDate;

    res.json({
      contractValue: contractValue.toFixed(2),
      claimedToDate: claimedToDate.toFixed(2),
      remainingValue: remaining.toFixed(2),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching job claim summary");
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.get("/api/progress-claims/job/:jobId/retention-summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = String(req.params.jobId);

    const [contract] = await db
      .select({
        retentionPercentage: contracts.retentionPercentage,
        retentionCap: contracts.retentionCap,
        originalContractValue: contracts.originalContractValue,
        revisedContractValue: contracts.revisedContractValue,
      })
      .from(contracts)
      .where(and(eq(contracts.jobId, jobId), eq(contracts.companyId, companyId)));

    const retentionRate = safeParseFinancial(contract?.retentionPercentage, 10);
    const retentionCapPct = safeParseFinancial(contract?.retentionCap, 5);
    const contractValue = safeParseFinancial(contract?.revisedContractValue || contract?.originalContractValue, 0);
    const retentionCapAmount = contractValue > 0 ? contractValue * retentionCapPct / 100 : 0;

    const claims = await db
      .select({
        id: progressClaims.id,
        claimNumber: progressClaims.claimNumber,
        status: progressClaims.status,
        claimDate: progressClaims.claimDate,
        subtotal: progressClaims.subtotal,
        total: progressClaims.total,
        retentionRate: progressClaims.retentionRate,
        retentionAmount: progressClaims.retentionAmount,
        retentionHeldToDate: progressClaims.retentionHeldToDate,
        netClaimAmount: progressClaims.netClaimAmount,
      })
      .from(progressClaims)
      .where(and(
        eq(progressClaims.companyId, companyId),
        eq(progressClaims.jobId, jobId),
      ))
      .orderBy(progressClaims.claimDate)
      .limit(1000);

    const totalRetentionHeld = claims.reduce(
      (sum, c) => sum + safeParseFinancial(c.retentionAmount, 0), 0
    );

    res.json({
      retentionRate,
      retentionCapPct,
      contractValue: contractValue.toFixed(2),
      retentionCapAmount: retentionCapAmount.toFixed(2),
      totalRetentionHeld: totalRetentionHeld.toFixed(2),
      remainingRetention: Math.max(0, retentionCapAmount - totalRetentionHeld).toFixed(2),
      claims: claims.map((c, idx) => {
        const runningTotal = claims.slice(0, idx + 1).reduce(
          (sum, cl) => sum + safeParseFinancial(cl.retentionAmount, 0), 0
        );
        return {
          ...c,
          cumulativeRetention: runningTotal.toFixed(2),
        };
      }),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching retention summary");
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
