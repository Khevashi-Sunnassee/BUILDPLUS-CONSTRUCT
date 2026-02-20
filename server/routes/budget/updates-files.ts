import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { parseEmailFile, summarizeEmailBody } from "../../utils/email-parser";
import { requireUUID } from "../../lib/api-utils";
import { db } from "../../db";
import { budgetLines, budgetLineFiles, budgetLineUpdates, budgetLineDetailItems, users } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { upload, budgetEmailUpload, detailItemSchema, recalcLockedBudget } from "./shared";

const router = Router();

router.get("/api/budget-lines/:lineId/updates", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = requireUUID(req, res, "lineId");
    if (!lineId) return;
    const updates = await db
      .select({
        id: budgetLineUpdates.id,
        budgetLineId: budgetLineUpdates.budgetLineId,
        userId: budgetLineUpdates.userId,
        content: budgetLineUpdates.content,
        contentType: budgetLineUpdates.contentType,
        emailSubject: budgetLineUpdates.emailSubject,
        emailFrom: budgetLineUpdates.emailFrom,
        emailTo: budgetLineUpdates.emailTo,
        emailDate: budgetLineUpdates.emailDate,
        emailBody: budgetLineUpdates.emailBody,
        createdAt: budgetLineUpdates.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(budgetLineUpdates)
      .innerJoin(users, eq(budgetLineUpdates.userId, users.id))
      .where(eq(budgetLineUpdates.budgetLineId, lineId))
      .orderBy(desc(budgetLineUpdates.createdAt))
      .limit(1000);

    const filesForUpdates = await db
      .select()
      .from(budgetLineFiles)
      .where(and(
        eq(budgetLineFiles.budgetLineId, lineId),
        sql`${budgetLineFiles.updateId} IS NOT NULL`
      ))
      .limit(1000);

    const updatesWithFiles = updates.map(u => ({
      ...u,
      files: filesForUpdates.filter(f => f.updateId === u.id),
    }));

    res.json(updatesWithFiles);
  } catch (error: unknown) {
    logger.error({ error }, "Error fetching budget line updates");
    res.status(500).json({ message: "Failed to fetch updates" });
  }
});

router.post("/api/budget-lines/:lineId/updates", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = requireUUID(req, res, "lineId");
    if (!lineId) return;
    const userId = req.session.userId!;
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);

    const [update] = await db
      .insert(budgetLineUpdates)
      .values({ budgetLineId: lineId, userId, content })
      .returning();

    res.status(201).json(update);
  } catch (error: unknown) {
    logger.error({ error }, "Error creating budget line update");
    res.status(500).json({ message: "Failed to create update" });
  }
});

router.delete("/api/budget-line-updates/:id", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const [update] = await db.select({ id: budgetLineUpdates.id, budgetLineId: budgetLineUpdates.budgetLineId })
      .from(budgetLineUpdates)
      .innerJoin(budgetLines, eq(budgetLineUpdates.budgetLineId, budgetLines.id))
      .where(and(eq(budgetLineUpdates.id, id), eq(budgetLines.companyId, companyId)));
    if (!update) return res.status(404).json({ message: "Update not found" });
    await db.delete(budgetLineUpdates).where(eq(budgetLineUpdates.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting budget line update");
    res.status(500).json({ message: "Failed to delete update" });
  }
});

router.post("/api/budget-lines/:lineId/email-drop", requireAuth, requirePermission("budgets", "VIEW"), budgetEmailUpload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const lineId = requireUUID(req, res, "lineId");
    if (!lineId) return;

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const parsed = await parseEmailFile(file.buffer, file.originalname || "email");
    const summary = await summarizeEmailBody(parsed.body, 80);

    const [update] = await db.insert(budgetLineUpdates).values({
      budgetLineId: lineId,
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
    logger.error({ error }, "Error processing budget line email drop");
    res.status(500).json({ error: "Failed to process email" });
  }
});

router.get("/api/budget-lines/:lineId/files", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const lineId = requireUUID(req, res, "lineId");
    if (!lineId) return;
    const files = await db
      .select({
        id: budgetLineFiles.id,
        budgetLineId: budgetLineFiles.budgetLineId,
        updateId: budgetLineFiles.updateId,
        fileName: budgetLineFiles.fileName,
        fileUrl: budgetLineFiles.fileUrl,
        fileSize: budgetLineFiles.fileSize,
        mimeType: budgetLineFiles.mimeType,
        uploadedById: budgetLineFiles.uploadedById,
        createdAt: budgetLineFiles.createdAt,
        uploadedBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(budgetLineFiles)
      .leftJoin(users, eq(budgetLineFiles.uploadedById, users.id))
      .where(eq(budgetLineFiles.budgetLineId, lineId))
      .orderBy(desc(budgetLineFiles.createdAt))
      .limit(1000);

    res.json(files);
  } catch (error: unknown) {
    logger.error({ error }, "Error fetching budget line files");
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

router.post("/api/budget-lines/:lineId/files", requireAuth, requirePermission("budgets", "VIEW"), upload.single("file"), async (req: Request, res: Response) => {
  try {
    const lineId = requireUUID(req, res, "lineId");
    if (!lineId) return;
    const userId = req.session.userId!;
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;
    const updateId = req.body.updateId || null;

    const [created] = await db
      .insert(budgetLineFiles)
      .values({
        budgetLineId: lineId,
        updateId,
        fileName: file.originalname,
        fileUrl: dataUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: unknown) {
    logger.error({ error }, "Error uploading budget line file");
    res.status(500).json({ message: "Failed to upload file" });
  }
});

router.delete("/api/budget-line-files/:id", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const [file] = await db.select({ id: budgetLineFiles.id })
      .from(budgetLineFiles)
      .innerJoin(budgetLines, eq(budgetLineFiles.budgetLineId, budgetLines.id))
      .where(and(eq(budgetLineFiles.id, id), eq(budgetLines.companyId, companyId)));
    if (!file) return res.status(404).json({ message: "File not found" });
    await db.delete(budgetLineFiles).where(eq(budgetLineFiles.id, id));
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting budget line file");
    res.status(500).json({ message: "Failed to delete file" });
  }
});

router.get("/api/budget-lines/:budgetLineId/detail-items", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const budgetLineId = requireUUID(req, res, "budgetLineId");
    if (!budgetLineId) return;

    const items = await db
      .select()
      .from(budgetLineDetailItems)
      .where(and(
        eq(budgetLineDetailItems.budgetLineId, budgetLineId),
        eq(budgetLineDetailItems.companyId, companyId),
      ))
      .orderBy(asc(budgetLineDetailItems.sortOrder), asc(budgetLineDetailItems.createdAt))
      .limit(1000);

    res.json(items);
  } catch (error: unknown) {
    logger.error({ error }, "Error fetching budget line detail items");
    res.status(500).json({ message: "Failed to fetch detail items" });
  }
});

router.post("/api/budget-lines/:budgetLineId/detail-items", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const budgetLineId = requireUUID(req, res, "budgetLineId");
    if (!budgetLineId) return;
    const data = detailItemSchema.parse(req.body);

    const qty = parseFloat(data.quantity || "0");
    const price = parseFloat(data.price || "0");
    const lineTotal = (qty * price).toFixed(2);

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${budgetLineDetailItems.sortOrder}), -1)` })
      .from(budgetLineDetailItems)
      .where(eq(budgetLineDetailItems.budgetLineId, budgetLineId));

    const [newItem] = await db.insert(budgetLineDetailItems).values({
      companyId,
      budgetLineId,
      item: data.item,
      quantity: data.quantity || "0",
      unit: data.unit || "EA",
      price: data.price || "0",
      lineTotal,
      notes: data.notes || null,
      sortOrder: data.sortOrder ?? (maxOrder[0]?.max ?? -1) + 1,
    }).returning();

    await recalcLockedBudget(budgetLineId, companyId);

    res.json(newItem);
  } catch (error: unknown) {
    logger.error({ error }, "Error creating budget line detail item");
    res.status(500).json({ message: "Failed to create detail item" });
  }
});

router.patch("/api/budget-line-detail-items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;
    const data = detailItemSchema.partial().parse(req.body);

    const [existing] = await db.select().from(budgetLineDetailItems).where(and(
      eq(budgetLineDetailItems.id, id),
      eq(budgetLineDetailItems.companyId, companyId),
    ));
    if (!existing) return res.status(404).json({ message: "Item not found" });

    const qty = parseFloat(data.quantity ?? existing.quantity ?? "0");
    const price = parseFloat(data.price ?? existing.price ?? "0");
    const lineTotal = (qty * price).toFixed(2);

    const [updated] = await db.update(budgetLineDetailItems)
      .set({
        ...(data.item !== undefined && { item: data.item }),
        ...(data.quantity !== undefined && { quantity: data.quantity || "0" }),
        ...(data.unit !== undefined && { unit: data.unit || "EA" }),
        ...(data.price !== undefined && { price: data.price || "0" }),
        lineTotal,
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(and(eq(budgetLineDetailItems.id, id), eq(budgetLineDetailItems.companyId, companyId)))
      .returning();

    await recalcLockedBudget(existing.budgetLineId, companyId);

    res.json(updated);
  } catch (error: unknown) {
    logger.error({ error }, "Error updating budget line detail item");
    res.status(500).json({ message: "Failed to update detail item" });
  }
});

router.delete("/api/budget-line-detail-items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = requireUUID(req, res, "id");
    if (!id) return;

    const [existing] = await db.select().from(budgetLineDetailItems).where(and(
      eq(budgetLineDetailItems.id, id),
      eq(budgetLineDetailItems.companyId, companyId),
    ));
    if (!existing) return res.status(404).json({ message: "Item not found" });

    await db.delete(budgetLineDetailItems).where(eq(budgetLineDetailItems.id, id));

    await recalcLockedBudget(existing.budgetLineId, companyId);

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error }, "Error deleting budget line detail item");
    res.status(500).json({ message: "Failed to delete detail item" });
  }
});

router.patch("/api/budget-lines/:budgetLineId/toggle-lock", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const budgetLineId = requireUUID(req, res, "budgetLineId");
    if (!budgetLineId) return;
    const { locked } = req.body;

    const [line] = await db.select().from(budgetLines).where(and(
      eq(budgetLines.id, budgetLineId),
      eq(budgetLines.companyId, companyId),
    ));
    if (!line) return res.status(404).json({ message: "Budget line not found" });

    await db.update(budgetLines)
      .set({ estimateLocked: !!locked, updatedAt: new Date() })
      .where(eq(budgetLines.id, budgetLineId));

    if (locked) {
      await recalcLockedBudget(budgetLineId, companyId);
    }

    res.json({ success: true, locked: !!locked });
  } catch (error: unknown) {
    logger.error({ error }, "Error toggling budget lock");
    res.status(500).json({ message: "Failed to toggle lock" });
  }
});

export default router;
