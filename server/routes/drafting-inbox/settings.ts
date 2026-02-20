import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { draftingInboundEmails, draftingInboxSettings, draftingEmailDocuments, companies, jobs, taskGroups } from "@shared/schema";
import { requireUUID } from "../../lib/api-utils";
import { storage } from "../../storage";
import { objectStorageService, upload, logDraftingEmailActivity } from "./shared";

const router = Router();

router.get("/api/drafting-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    const [company] = await db.select({ draftingInboxEmail: companies.draftingInboxEmail })
      .from(companies).where(eq(companies.id, companyId)).limit(1);
    const centralEmail = company?.draftingInboxEmail || null;

    if (!settings) {
      return res.json({
        companyId,
        isEnabled: false,
        inboundEmailAddress: centralEmail,
        autoExtract: true,
        notifyUserIds: [],
      });
    }

    res.json({ ...settings, inboundEmailAddress: centralEmail || settings.inboundEmailAddress });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch drafting inbox settings" });
  }
});

router.put("/api/drafting-inbox/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const { inboundEmailAddress: _ignored, ...body } = z.object({
      isEnabled: z.boolean().optional(),
      inboundEmailAddress: z.string().nullable().optional(),
      autoExtract: z.boolean().optional(),
      notifyUserIds: z.array(z.string()).optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    let settings;
    if (existing) {
      [settings] = await db.update(draftingInboxSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(draftingInboxSettings.companyId, companyId))
        .returning();
    } else {
      [settings] = await db.insert(draftingInboxSettings)
        .values({ companyId, ...body })
        .returning();
    }

    res.json(settings);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating drafting inbox settings");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update drafting inbox settings" });
  }
});

router.post("/api/drafting-inbox/upload", requireAuth, upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "Company context required" });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: "At least one file is required" });

    const [settings] = await db.select().from(draftingInboxSettings)
      .where(eq(draftingInboxSettings.companyId, companyId)).limit(1);

    const createdEmails = [];

    for (const file of files) {
      const fileExt = file.originalname.split(".").pop() || "pdf";
      const storageKey = `drafting-emails/${companyId}/${crypto.randomUUID()}.${fileExt}`;

      await objectStorageService.uploadFile(storageKey, file.buffer, file.mimetype);

      const [emailRecord] = await db.insert(draftingInboundEmails).values({
        companyId,
        resendEmailId: `manual-upload-${crypto.randomUUID()}`,
        fromAddress: "manual-upload",
        toAddress: null,
        subject: file.originalname,
        status: "RECEIVED",
        attachmentCount: 1,
      }).returning();

      await db.insert(draftingEmailDocuments).values({
        inboundEmailId: emailRecord.id,
        storageKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      });

      await logDraftingEmailActivity(emailRecord.id, "uploaded", `Document uploaded manually by user`, userId, {
        fileName: file.originalname,
        fileSize: file.size,
      });

      if (settings?.autoExtract) {
        try {
          const { extractDraftingEmailFromDocument } = await import("../../lib/drafting-inbox-jobs");
          await extractDraftingEmailFromDocument(emailRecord.id, companyId, file.buffer, file.mimetype);
        } catch (extractErr: any) {
          logger.warn({ err: extractErr }, "Drafting email extraction failed");
        }
      }

      const [updated] = await db.select().from(draftingInboundEmails)
        .where(eq(draftingInboundEmails.id, emailRecord.id)).limit(1);
      createdEmails.push(updated || emailRecord);
    }

    res.json(createdEmails.length === 1 ? createdEmails[0] : { emails: createdEmails, count: createdEmails.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error uploading drafting email document");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
});

const draftingTaskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  actionType: z.string().min(1, "Action type is required").max(100),
  description: z.string().max(2000).optional(),
  jobId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

router.get("/api/drafting-inbox/emails/:id/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const linkedTasks = await storage.getTasksByDraftingEmailId(id, companyId);
    res.json(linkedTasks);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching drafting email tasks");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch tasks" });
  }
});

router.post("/api/drafting-inbox/emails/:id/tasks", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [email] = await db.select().from(draftingInboundEmails)
      .where(and(eq(draftingInboundEmails.id, id), eq(draftingInboundEmails.companyId, companyId))).limit(1);
    if (!email) return res.status(404).json({ error: "Drafting email not found" });

    const parsed = draftingTaskCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { title, actionType, description, jobId, dueDate, priority, assigneeIds } = parsed.data;

    let resolvedJob: { id: string; jobNumber: string; name: string } | null = null;
    if (jobId) {
      const [job] = await db.select({ id: jobs.id, jobNumber: jobs.jobNumber, name: jobs.name }).from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) {
        return res.status(400).json({ error: "Invalid job for this company" });
      }
      resolvedJob = job;
    }

    let emailActionsGroupId: string;
    if (resolvedJob) {
      const groupName = `${resolvedJob.jobNumber} Email Actions`;
      const [existingGroup] = await db.select().from(taskGroups)
        .where(and(
          eq(taskGroups.companyId, companyId),
          eq(taskGroups.jobId, resolvedJob.id),
          eq(taskGroups.name, groupName),
        ))
        .limit(1);
      if (existingGroup) {
        emailActionsGroupId = existingGroup.id;
      } else {
        const newGroup = await storage.createTaskGroup({
          name: groupName,
          companyId,
          jobId: resolvedJob.id,
          createdById: userId,
        });
        emailActionsGroupId = newGroup.id;
      }
    } else {
      const fallbackName = "Email Actions (Unassigned)";
      const [fallbackGroup] = await db.select().from(taskGroups)
        .where(and(eq(taskGroups.companyId, companyId), eq(taskGroups.name, fallbackName)))
        .limit(1);
      if (fallbackGroup) {
        emailActionsGroupId = fallbackGroup.id;
      } else {
        const newGroup = await storage.createTaskGroup({
          name: fallbackName,
          companyId,
          createdById: userId,
        });
        emailActionsGroupId = newGroup.id;
      }
    }

    const fullTitle = `[${actionType}] ${title}`;
    const task = await storage.createTask({
      groupId: emailActionsGroupId,
      title: fullTitle,
      status: "NOT_STARTED",
      jobId: jobId || null,
      draftingEmailId: id,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "MEDIUM",
      consultant: description || null,
      createdById: userId,
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await storage.setTaskAssignees(task.id, assigneeIds);
    }

    const emailLink = `/drafting-emails/${id}`;
    await storage.createTaskUpdate({
      taskId: task.id,
      userId: userId!,
      content: `Created from drafting email. View original: ${emailLink}`,
      contentType: "note",
    });

    await db.update(draftingInboundEmails)
      .set({ status: "ALLOCATED" })
      .where(eq(draftingInboundEmails.id, id));

    await logDraftingEmailActivity(
      id,
      "task_created",
      `Task created: ${fullTitle}`,
      userId,
      { taskId: task.id, actionType, priority }
    );

    const taskWithDetails = await storage.getTask(task.id);
    res.status(201).json(taskWithDetails || task);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating drafting email task");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create task" });
  }
});

export default router;
