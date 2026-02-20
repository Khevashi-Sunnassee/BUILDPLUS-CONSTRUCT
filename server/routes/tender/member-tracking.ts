import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { parseEmailFile, summarizeEmailBody } from "../../utils/email-parser";
import { db } from "../../db";
import { tenderMemberUpdates, tenderMemberFiles, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import {
  isValidId,
  verifyTenderMemberOwnership,
  tenderMemberUpdateSchema,
  tenderUpload,
  tenderEmailUpload,
} from "./shared";

const router = Router();

router.get("/api/tender-members/:id/updates", requireAuth, requirePermission("tenders"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const memberId = String(req.params.id);
    if (!isValidId(memberId)) return res.status(400).json({ error: "Invalid member ID" });
    const member = await verifyTenderMemberOwnership(companyId, memberId);
    if (!member) return res.status(404).json({ error: "Invitation not found" });

    const updates = await db.select({
      id: tenderMemberUpdates.id,
      tenderMemberId: tenderMemberUpdates.tenderMemberId,
      userId: tenderMemberUpdates.userId,
      content: tenderMemberUpdates.content,
      contentType: tenderMemberUpdates.contentType,
      emailSubject: tenderMemberUpdates.emailSubject,
      emailFrom: tenderMemberUpdates.emailFrom,
      emailTo: tenderMemberUpdates.emailTo,
      emailDate: tenderMemberUpdates.emailDate,
      emailBody: tenderMemberUpdates.emailBody,
      createdAt: tenderMemberUpdates.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    }).from(tenderMemberUpdates)
      .leftJoin(users, eq(tenderMemberUpdates.userId, users.id))
      .where(eq(tenderMemberUpdates.tenderMemberId, memberId))
      .orderBy(desc(tenderMemberUpdates.createdAt))
      .limit(1000);

    const updatesWithFiles = await Promise.all(updates.map(async (update) => {
      const files = await db.select().from(tenderMemberFiles)
        .where(eq(tenderMemberFiles.updateId, update.id))
        .limit(500);
      return { ...update, files };
    }));

    res.json(updatesWithFiles);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender member updates");
    res.status(500).json({ error: "Failed to fetch updates" });
  }
});

router.post("/api/tender-members/:id/updates", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const memberId = String(req.params.id);
    if (!isValidId(memberId)) return res.status(400).json({ error: "Invalid member ID" });
    const member = await verifyTenderMemberOwnership(companyId, memberId);
    if (!member) return res.status(404).json({ error: "Invitation not found" });
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const parsed = tenderMemberUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const [update] = await db.insert(tenderMemberUpdates).values({
      tenderMemberId: memberId,
      userId,
      content: parsed.data.content,
    }).returning();

    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating tender member update");
    res.status(500).json({ error: "Failed to create update" });
  }
});

router.delete("/api/tender-member-updates/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const updateId = String(req.params.id);
    if (!isValidId(updateId)) return res.status(400).json({ error: "Invalid update ID" });

    const [update] = await db.select().from(tenderMemberUpdates).where(eq(tenderMemberUpdates.id, updateId)).limit(1);
    if (!update) return res.status(404).json({ error: "Update not found" });

    const member = await verifyTenderMemberOwnership(companyId, update.tenderMemberId);
    if (!member) return res.status(404).json({ error: "Update not found" });

    await db.delete(tenderMemberUpdates).where(eq(tenderMemberUpdates.id, updateId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting tender member update");
    res.status(500).json({ error: "Failed to delete update" });
  }
});

router.post("/api/tender-members/:id/email-drop", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), tenderEmailUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const memberId = String(req.params.id);

    const member = await verifyTenderMemberOwnership(companyId, memberId);
    if (!member) return res.status(404).json({ error: "Invitation not found" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const parsed = await parseEmailFile(file.buffer, file.originalname || "email");
    const summary = await summarizeEmailBody(parsed.body, 80);

    const [update] = await db.insert(tenderMemberUpdates).values({
      tenderMemberId: memberId,
      userId,
      content: summary,
      contentType: "email",
      emailSubject: parsed.subject,
      emailFrom: parsed.from,
      emailTo: parsed.to,
      emailDate: parsed.date,
      emailBody: parsed.body,
    }).returning();

    res.json(update);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error processing tender member email drop");
    res.status(500).json({ error: "Failed to process email" });
  }
});

router.get("/api/tender-members/:id/files", requireAuth, requirePermission("tenders"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const memberId = String(req.params.id);
    if (!isValidId(memberId)) return res.status(400).json({ error: "Invalid member ID" });
    const member = await verifyTenderMemberOwnership(companyId, memberId);
    if (!member) return res.status(404).json({ error: "Invitation not found" });

    const files = await db.select().from(tenderMemberFiles)
      .where(eq(tenderMemberFiles.tenderMemberId, memberId))
      .orderBy(desc(tenderMemberFiles.createdAt))
      .limit(500);

    res.json(files);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching tender member files");
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.post("/api/tender-members/:id/files", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), tenderUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const memberId = String(req.params.id);
    if (!isValidId(memberId)) return res.status(400).json({ error: "Invalid member ID" });
    const member = await verifyTenderMemberOwnership(companyId, memberId);
    if (!member) return res.status(404).json({ error: "Invitation not found" });
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const updateId = req.body.updateId || null;

    const [memberFile] = await db.insert(tenderMemberFiles).values({
      tenderMemberId: memberId,
      updateId,
      fileName: file.originalname,
      fileUrl: dataUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedById: userId,
    }).returning();

    res.status(201).json(memberFile);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading tender member file");
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.delete("/api/tender-member-files/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const fileId = String(req.params.id);
    if (!isValidId(fileId)) return res.status(400).json({ error: "Invalid file ID" });

    const [file] = await db.select().from(tenderMemberFiles).where(eq(tenderMemberFiles.id, fileId)).limit(1);
    if (!file) return res.status(404).json({ error: "File not found" });

    const member = await verifyTenderMemberOwnership(companyId, file.tenderMemberId);
    if (!member) return res.status(404).json({ error: "File not found" });

    await db.delete(tenderMemberFiles).where(eq(tenderMemberFiles.id, fileId));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting tender member file");
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
