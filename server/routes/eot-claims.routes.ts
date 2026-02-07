import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { insertEotClaimSchema } from "@shared/schema";
import logger from "../lib/logger";

const router = Router();

router.get("/api/eot-claims", requireAuth, async (req, res) => {
  try {
    const claims = await storage.getEotClaims();
    res.json(claims);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching EOT claims");
    res.status(500).json({ error: "Failed to fetch EOT claims" });
  }
});

router.get("/api/eot-claims/by-job/:jobId", requireAuth, async (req, res) => {
  try {
    const claims = await storage.getEotClaimsByJob(String(req.params.jobId));
    res.json(claims);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching EOT claims by job");
    res.status(500).json({ error: "Failed to fetch EOT claims" });
  }
});

router.get("/api/eot-claims/:id", requireAuth, async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    res.json(claim);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching EOT claim");
    res.status(500).json({ error: "Failed to fetch EOT claim" });
  }
});

router.post("/api/eot-claims", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { jobId } = req.body;

    const claimNumber = await storage.getNextEotClaimNumber(jobId);

    const data = {
      ...req.body,
      claimNumber,
      createdById: userId,
    };

    const parseResult = insertEotClaimSchema.safeParse(data);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request data" });
    }

    const claim = await storage.createEotClaim(parseResult.data);
    res.json(claim);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating EOT claim");
    res.status(500).json({ error: "Failed to create EOT claim" });
  }
});

router.put("/api/eot-claims/:id", requireAuth, async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    if (claim.status !== "DRAFT") {
      return res.status(400).json({ error: "Can only update draft EOT claims" });
    }

    const updated = await storage.updateEotClaim(String(req.params.id), req.body);
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating EOT claim");
    res.status(500).json({ error: "Failed to update EOT claim" });
  }
});

router.post("/api/eot-claims/:id/submit", requireAuth, async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    if (claim.status !== "DRAFT") {
      return res.status(400).json({ error: "Can only submit draft EOT claims" });
    }

    const updated = await storage.submitEotClaim(String(req.params.id));
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error submitting EOT claim");
    res.status(500).json({ error: "Failed to submit EOT claim" });
  }
});

router.post("/api/eot-claims/:id/approve", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    if (claim.status !== "SUBMITTED" && claim.status !== "UNDER_REVIEW") {
      return res.status(400).json({ error: "Can only approve submitted or under-review EOT claims" });
    }

    const { reviewNotes, approvedDays } = req.body;
    const reviewedById = req.session.userId!;
    const updated = await storage.approveEotClaim(
      String(req.params.id),
      reviewedById,
      reviewNotes || "",
      approvedDays ?? claim.requestedDays
    );
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error approving EOT claim");
    res.status(500).json({ error: "Failed to approve EOT claim" });
  }
});

router.post("/api/eot-claims/:id/reject", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    if (claim.status !== "SUBMITTED" && claim.status !== "UNDER_REVIEW") {
      return res.status(400).json({ error: "Can only reject submitted or under-review EOT claims" });
    }

    const { reviewNotes } = req.body;
    const reviewedById = req.session.userId!;
    const updated = await storage.rejectEotClaim(
      String(req.params.id),
      reviewedById,
      reviewNotes || "No reason provided"
    );
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error rejecting EOT claim");
    res.status(500).json({ error: "Failed to reject EOT claim" });
  }
});

router.delete("/api/eot-claims/:id", requireAuth, async (req, res) => {
  try {
    const claim = await storage.getEotClaim(String(req.params.id));
    if (!claim) {
      return res.status(404).json({ error: "EOT claim not found" });
    }
    if (claim.status !== "DRAFT") {
      return res.status(400).json({ error: "Can only delete draft EOT claims" });
    }

    await storage.deleteEotClaim(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting EOT claim");
    res.status(500).json({ error: "Failed to delete EOT claim" });
  }
});

router.get("/api/eot-claims/next-number/:jobId", requireAuth, async (req, res) => {
  try {
    const claimNumber = await storage.getNextEotClaimNumber(String(req.params.jobId));
    res.json({ claimNumber });
  } catch (error: any) {
    logger.error({ err: error }, "Error getting next EOT claim number");
    res.status(500).json({ error: "Failed to get next claim number" });
  }
});

export const eotClaimsRouter = router;
