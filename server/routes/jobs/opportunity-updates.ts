import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { parseEmailFile, summarizeEmailBody } from "../../utils/email-parser";

const router = Router();

const oppUpdateSchema = z.object({ content: z.string().min(1) });
const oppUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const oppEmailUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.get("/api/opportunities/:id/updates", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const updates = await storage.getOpportunityUpdates(jobId);
    res.json(updates);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching opportunity updates");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch opportunity updates" });
  }
});

router.post("/api/opportunities/:id/updates", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = oppUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const update = await storage.createOpportunityUpdate({
      jobId,
      userId,
      content: parsed.data.content,
    });
    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating opportunity update");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create opportunity update" });
  }
});

router.post("/api/opportunities/:id/email-drop", requireAuth, oppEmailUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const parsed = await parseEmailFile(file.buffer, file.originalname || "email");
    const summary = await summarizeEmailBody(parsed.body, 80);
    const update = await storage.createOpportunityUpdate({
      jobId,
      userId,
      content: summary,
      contentType: "email",
      emailSubject: parsed.subject,
      emailFrom: parsed.from,
      emailTo: parsed.to,
      emailDate: parsed.date,
      emailBody: parsed.body,
    });
    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error processing opportunity email drop");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process email" });
  }
});

router.delete("/api/opportunity-updates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const update = await storage.getOpportunityUpdate(String(req.params.id));
    if (!update) return res.status(404).json({ error: "Update not found" });
    const job = await storage.getJob(update.jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Update not found" });
    }
    await storage.deleteOpportunityUpdate(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting opportunity update");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete opportunity update" });
  }
});

router.get("/api/opportunities/:id/files", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const files = await storage.getOpportunityFiles(jobId);
    res.json(files);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching opportunity files");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch opportunity files" });
  }
});

router.post("/api/opportunities/:id/files", requireAuth, oppUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = await storage.getJob(jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "Opportunity not found" });
    }
    const userId = req.session.userId;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const updateId = req.body.updateId || null;
    const oppFile = await storage.createOpportunityFile({
      jobId,
      updateId,
      fileName: file.originalname,
      fileUrl: dataUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: userId,
    });
    res.status(201).json(oppFile);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading opportunity file");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload opportunity file" });
  }
});

router.delete("/api/opportunity-files/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const file = await storage.getOpportunityFile(String(req.params.id));
    if (!file) return res.status(404).json({ error: "File not found" });
    const job = await storage.getJob(file.jobId);
    if (!job || job.companyId !== req.companyId) {
      return res.status(404).json({ error: "File not found" });
    }
    await storage.deleteOpportunityFile(String(req.params.id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting opportunity file");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete opportunity file" });
  }
});

export default router;
