import { Router } from "express";
import { db } from "../db";
import { companyEmailInboxes, companies } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { z } from "zod";
import logger from "../lib/logger";

export const companyEmailInboxesRouter = Router();

const createInboxSchema = z.object({
  inboxType: z.enum(["DRAFTING", "TENDER", "AP_INVOICES", "GENERAL"]),
  emailAddress: z.string().email().max(255),
  displayName: z.string().max(255).optional(),
  replyToAddress: z.string().email().max(255).nullable().optional(),
  isDefault: z.boolean().optional(),
});

const updateInboxSchema = z.object({
  emailAddress: z.string().email().max(255).optional(),
  displayName: z.string().max(255).optional(),
  replyToAddress: z.string().email().max(255).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

companyEmailInboxesRouter.get("/api/company-email-inboxes", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const inboxes = await db
      .select()
      .from(companyEmailInboxes)
      .where(eq(companyEmailInboxes.companyId, companyId))
      .orderBy(companyEmailInboxes.inboxType, companyEmailInboxes.displayName)
      .limit(100);
    res.json(inboxes);
  } catch (error) {
    logger.error({ err: error }, "Error fetching company email inboxes");
    res.status(500).json({ error: "Failed to fetch email inboxes" });
  }
});

companyEmailInboxesRouter.get("/api/company-email-inboxes/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const inboxes = await db
      .select()
      .from(companyEmailInboxes)
      .where(and(eq(companyEmailInboxes.companyId, companyId), eq(companyEmailInboxes.isActive, true)))
      .orderBy(companyEmailInboxes.inboxType, companyEmailInboxes.displayName)
      .limit(100);
    res.json(inboxes);
  } catch (error) {
    logger.error({ err: error }, "Error fetching active email inboxes");
    res.status(500).json({ error: "Failed to fetch active email inboxes" });
  }
});

companyEmailInboxesRouter.post("/api/company-email-inboxes", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const parsed = createInboxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const emailLower = data.emailAddress.toLowerCase().trim();

    const [existing] = await db
      .select({ id: companyEmailInboxes.id })
      .from(companyEmailInboxes)
      .where(eq(companyEmailInboxes.emailAddress, emailLower))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Email address already in use by another inbox" });
    }

    if (data.isDefault) {
      const [existingDefault] = await db.select({ id: companyEmailInboxes.id })
        .from(companyEmailInboxes)
        .where(and(
          eq(companyEmailInboxes.companyId, companyId),
          eq(companyEmailInboxes.inboxType, data.inboxType),
          eq(companyEmailInboxes.isDefault, true)
        ))
        .limit(1);
      if (existingDefault) {
        return res.status(409).json({ error: `A default ${data.inboxType} inbox already exists. Please remove the existing default before setting a new one.` });
      }
    }

    const [inbox] = await db.insert(companyEmailInboxes).values({
      companyId,
      inboxType: data.inboxType,
      emailAddress: emailLower,
      displayName: (data.displayName || "").trim(),
      replyToAddress: data.replyToAddress ? data.replyToAddress.toLowerCase().trim() : null,
      isDefault: data.isDefault || false,
    }).returning();

    logger.info({ inboxId: inbox.id, companyId, type: data.inboxType, email: emailLower }, "Company email inbox created");
    res.status(201).json(inbox);
  } catch (error) {
    logger.error({ err: error }, "Error creating company email inbox");
    res.status(500).json({ error: "Failed to create email inbox" });
  }
});

companyEmailInboxesRouter.patch("/api/company-email-inboxes/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const inboxId = String(req.params.id);

    const parsed = updateInboxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [existing] = await db
      .select()
      .from(companyEmailInboxes)
      .where(and(eq(companyEmailInboxes.id, inboxId), eq(companyEmailInboxes.companyId, companyId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Email inbox not found" });
    }

    const data = parsed.data;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (data.emailAddress !== undefined) {
      const emailLower = data.emailAddress.toLowerCase().trim();
      const [duplicate] = await db
        .select({ id: companyEmailInboxes.id })
        .from(companyEmailInboxes)
        .where(and(eq(companyEmailInboxes.emailAddress, emailLower), ne(companyEmailInboxes.id, inboxId)))
        .limit(1);
      if (duplicate) {
        return res.status(409).json({ error: "Email address already in use" });
      }
      updates.emailAddress = emailLower;
    }

    if (data.displayName !== undefined) updates.displayName = data.displayName.trim();
    if (data.replyToAddress !== undefined) updates.replyToAddress = data.replyToAddress ? data.replyToAddress.toLowerCase().trim() : null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    if (data.isDefault === true) {
      const [existingDefault] = await db.select({ id: companyEmailInboxes.id })
        .from(companyEmailInboxes)
        .where(and(
          eq(companyEmailInboxes.companyId, companyId),
          eq(companyEmailInboxes.inboxType, existing.inboxType),
          eq(companyEmailInboxes.isDefault, true),
          ne(companyEmailInboxes.id, inboxId)
        ))
        .limit(1);
      if (existingDefault) {
        return res.status(409).json({ error: `A default ${existing.inboxType} inbox already exists. Please remove the existing default before setting a new one.` });
      }
      updates.isDefault = true;
    } else if (data.isDefault === false) {
      updates.isDefault = false;
    }

    const [updated] = await db.update(companyEmailInboxes)
      .set(updates)
      .where(eq(companyEmailInboxes.id, inboxId))
      .returning();

    logger.info({ inboxId, companyId }, "Company email inbox updated");
    res.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Error updating company email inbox");
    res.status(500).json({ error: "Failed to update email inbox" });
  }
});

companyEmailInboxesRouter.delete("/api/company-email-inboxes/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId as string;
    const inboxId = String(req.params.id);

    const [existing] = await db
      .select()
      .from(companyEmailInboxes)
      .where(and(eq(companyEmailInboxes.id, inboxId), eq(companyEmailInboxes.companyId, companyId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Email inbox not found" });
    }

    await db.delete(companyEmailInboxes).where(eq(companyEmailInboxes.id, inboxId));
    logger.info({ inboxId, companyId, email: existing.emailAddress }, "Company email inbox deleted");
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Error deleting company email inbox");
    res.status(500).json({ error: "Failed to delete email inbox" });
  }
});
