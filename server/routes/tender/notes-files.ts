import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenderNotes, tenderFiles, users } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { emailService } from "../../services/email.service";
import { buildBrandedEmail } from "../../lib/email-template";
import { storage } from "../../storage";
import { isValidId, verifyTenderOwnership, tenderUpload, tenderObjectStorage } from "./shared";

const router = Router();

router.get("/api/tenders/:id/notes", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const notes = await db
      .select({
        id: tenderNotes.id,
        content: tenderNotes.content,
        createdAt: tenderNotes.createdAt,
        updatedAt: tenderNotes.updatedAt,
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenderNotes)
      .leftJoin(users, eq(tenderNotes.createdById, users.id))
      .where(and(eq(tenderNotes.tenderId, tenderId), eq(tenderNotes.companyId, companyId)))
      .orderBy(desc(tenderNotes.createdAt))
      .limit(1000);

    res.json(notes);
  } catch (error: unknown) {
    logger.error("Error fetching tender notes:", error);
    res.status(500).json({ message: "Failed to fetch notes", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/notes", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const schema = z.object({ content: z.string().min(1, "Note content is required") });
    const data = schema.parse(req.body);

    const [note] = await db
      .insert(tenderNotes)
      .values({
        companyId,
        tenderId,
        content: data.content,
        createdById: req.session.userId!,
      })
      .returning();

    res.json(note);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender note:", error);
    res.status(500).json({ message: "Failed to create note", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:id/notes/:noteId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, noteId } = req.params;
    if (!isValidId(tenderId) || !isValidId(noteId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const schema = z.object({ content: z.string().min(1, "Note content is required") });
    const data = schema.parse(req.body);

    const [updated] = await db
      .update(tenderNotes)
      .set({ content: data.content, updatedAt: new Date() })
      .where(and(eq(tenderNotes.id, noteId), eq(tenderNotes.tenderId, tenderId), eq(tenderNotes.companyId, companyId)))
      .returning();

    if (!updated) return res.status(404).json({ message: "Note not found", code: "NOT_FOUND" });
    res.json(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender note:", error);
    res.status(500).json({ message: "Failed to update note", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/tenders/:id/notes/:noteId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, noteId } = req.params;
    if (!isValidId(tenderId) || !isValidId(noteId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [deleted] = await db
      .delete(tenderNotes)
      .where(and(eq(tenderNotes.id, noteId), eq(tenderNotes.tenderId, tenderId), eq(tenderNotes.companyId, companyId)))
      .returning({ id: tenderNotes.id });

    if (!deleted) return res.status(404).json({ message: "Note not found", code: "NOT_FOUND" });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting tender note:", error);
    res.status(500).json({ message: "Failed to delete note", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id/files", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const files = await db
      .select({
        id: tenderFiles.id,
        fileName: tenderFiles.fileName,
        filePath: tenderFiles.filePath,
        fileSize: tenderFiles.fileSize,
        mimeType: tenderFiles.mimeType,
        description: tenderFiles.description,
        createdAt: tenderFiles.createdAt,
        uploadedBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenderFiles)
      .leftJoin(users, eq(tenderFiles.uploadedById, users.id))
      .where(and(eq(tenderFiles.tenderId, tenderId), eq(tenderFiles.companyId, companyId)))
      .orderBy(desc(tenderFiles.createdAt))
      .limit(1000);

    res.json(files);
  } catch (error: unknown) {
    logger.error("Error fetching tender files:", error);
    res.status(500).json({ message: "Failed to fetch files", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/files", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), tenderUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file provided", code: "VALIDATION_ERROR" });
    }

    const uploadURL = await tenderObjectStorage.getObjectEntityUploadURL();
    const objectPath = tenderObjectStorage.normalizeObjectEntityPath(uploadURL);

    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      body: req.file.buffer,
      headers: { "Content-Type": req.file.mimetype },
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to storage");
    }

    await tenderObjectStorage.trySetObjectEntityAclPolicy(objectPath, {
      owner: req.session.userId!,
      visibility: "private",
    });

    const description = req.body.description || null;

    const [file] = await db
      .insert(tenderFiles)
      .values({
        companyId,
        tenderId,
        fileName: req.file.originalname,
        filePath: objectPath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        description,
        uploadedById: req.session.userId!,
      })
      .returning();

    res.json(file);
  } catch (error: unknown) {
    logger.error("Error uploading tender file:", error);
    res.status(500).json({ message: "Failed to upload file", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id/files/:fileId/download", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, fileId } = req.params;
    if (!isValidId(tenderId) || !isValidId(fileId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [file] = await db
      .select()
      .from(tenderFiles)
      .where(and(eq(tenderFiles.id, fileId), eq(tenderFiles.tenderId, tenderId), eq(tenderFiles.companyId, companyId)));

    if (!file || !file.filePath) return res.status(404).json({ message: "File not found", code: "NOT_FOUND" });

    const objectFile = await tenderObjectStorage.getObjectEntityFile(file.filePath);
    await tenderObjectStorage.downloadObject(objectFile, res);
  } catch (error: unknown) {
    logger.error("Error downloading tender file:", error);
    res.status(500).json({ message: "Failed to download file", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/tenders/:id/files/:fileId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, fileId } = req.params;
    if (!isValidId(tenderId) || !isValidId(fileId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [deleted] = await db
      .delete(tenderFiles)
      .where(and(eq(tenderFiles.id, fileId), eq(tenderFiles.tenderId, tenderId), eq(tenderFiles.companyId, companyId)))
      .returning({ id: tenderFiles.id });

    if (!deleted) return res.status(404).json({ message: "File not found", code: "NOT_FOUND" });
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error("Error deleting tender file:", error);
    res.status(500).json({ message: "Failed to delete file", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/files/send-email", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      to: z.string().email("Valid email address is required"),
      cc: z.string().optional(),
      subject: z.string().min(1, "Subject is required"),
      message: z.string().min(1, "Message is required"),
      fileIds: z.array(z.string()).min(1, "At least one file must be selected"),
      sendCopy: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    const files = await db
      .select()
      .from(tenderFiles)
      .where(and(
        eq(tenderFiles.tenderId, tenderId),
        eq(tenderFiles.companyId, companyId),
        inArray(tenderFiles.id, data.fileIds)
      ))
      .limit(1000);

    if (files.length === 0) {
      return res.status(404).json({ error: "No matching files found" });
    }

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    const failedFiles: string[] = [];

    for (const file of files) {
      try {
        if (!file.filePath) { failedFiles.push(file.fileName); continue; }
        const objectFile = await tenderObjectStorage.getObjectEntityFile(file.filePath);
        const [metadata] = await objectFile.getMetadata();

        const chunks: Buffer[] = [];
        const stream = objectFile.createReadStream();
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => resolve());
          stream.on("error", (err: Error) => reject(err));
        });

        attachments.push({
          filename: file.fileName,
          content: Buffer.concat(chunks),
          contentType: (metadata as Record<string, string>).contentType || file.mimeType || "application/octet-stream",
        });
      } catch (err) {
        failedFiles.push(file.fileName);
        logger.warn({ fileId: file.id, err }, "Failed to load tender file for email attachment");
      }
    }

    if (attachments.length === 0) {
      return res.status(400).json({ error: `Could not load any files for attachment: ${failedFiles.join(", ")}` });
    }

    let bcc: string | undefined;
    let senderName = "A team member";
    if (req.session.userId) {
      const currentUser = await storage.getUser(req.session.userId);
      if (data.sendCopy && currentUser?.email) bcc = currentUser.email;
      if (currentUser) senderName = currentUser.name || currentUser.email;
    }

    const fileListHtml = files
      .map(f => `<tr>
        <td style="padding: 4px 8px; font-size: 13px; color: #334155;">${f.fileName}</td>
        <td style="padding: 4px 8px; font-size: 13px; color: #64748b;">${f.fileSize ? `${(f.fileSize / 1024).toFixed(0)} KB` : "-"}</td>
      </tr>`)
      .join("");

    const attachmentSummary = `
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #334155;">${attachments.length} File${attachments.length !== 1 ? "s" : ""} Attached:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
        <tr style="background-color: #e2e8f0;">
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">File Name</td>
          <td style="padding: 4px 8px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase;">Size</td>
        </tr>
        ${fileListHtml}
      </table>`;

    const htmlBody = await buildBrandedEmail({
      title: "Tender Files Shared With You",
      subtitle: `Sent by ${senderName}`,
      body: data.message.replace(/\n/g, "<br>"),
      attachmentSummary,
      footerNote: "Please download the attached files. If you have any questions, reply directly to this email.",
      companyId,
    });

    const result = await emailService.sendEmailWithAttachment({
      to: data.to,
      cc: data.cc,
      bcc,
      subject: data.subject,
      body: htmlBody,
      attachments,
    });

    if (result.success) {
      res.json({ success: true, messageId: result.messageId, attachedCount: attachments.length, failedFiles });
    } else {
      res.status(500).json({ error: result.error || "Failed to send email" });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending tender files email:", error);
    res.status(500).json({ message: "Failed to send email", code: "INTERNAL_ERROR" });
  }
});

export default router;
