import {
  Router,
  db,
  requireAuth,
  progressClaims,
  progressClaimItems,
  panelRegister,
  PANEL_LIFECYCLE_STATUS,
  eq,
  and,
  inArray,
  logger,
  safeParseFinancial,
  getPreviouslyClaimedPercents,
} from "./shared";
import type { Request, Response } from "express";

const router = Router();

router.post("/api/progress-claims/:id/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "DRAFT") return res.status(400).json({ error: "Only draft claims can be submitted" });

    const [updated] = await db.update(progressClaims)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(progressClaims.id, claim.id))
      .returning();

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error submitting progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/progress-claims/:id/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
    if (!claim) return res.status(404).json({ error: "Progress claim not found" });
    if (claim.status !== "SUBMITTED") return res.status(400).json({ error: "Only submitted claims can be approved" });

    const previousPercents = await getPreviouslyClaimedPercents(companyId, claim.jobId, claim.id);

    const updated = await db.transaction(async (tx) => {
      const [approvedClaim] = await tx.update(progressClaims)
        .set({
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(progressClaims.id, claim.id))
        .returning();

      const items = await tx.select().from(progressClaimItems)
        .where(eq(progressClaimItems.progressClaimId, claim.id))
        .limit(5000);

      const fullClaimPanelIds = items
        .filter(item => {
          const thisPercent = safeParseFinancial(item.percentComplete, 0);
          const prevPercent = previousPercents.get(item.panelId) || 0;
          return (prevPercent + thisPercent) >= 99.995;
        })
        .map(item => item.panelId);

      if (fullClaimPanelIds.length > 0) {
        await tx.update(panelRegister)
          .set({ lifecycleStatus: PANEL_LIFECYCLE_STATUS.CLAIMED, updatedAt: new Date() })
          .where(inArray(panelRegister.id, fullClaimPanelIds));
      }

      return approvedClaim;
    });

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error approving progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/progress-claims/:id/reject", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const id = req.params.id as string;
    const [claim] = await db.select().from(progressClaims)
      .where(and(eq(progressClaims.id, id), eq(progressClaims.companyId, companyId)));
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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error rejecting progress claim");
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export default router;
