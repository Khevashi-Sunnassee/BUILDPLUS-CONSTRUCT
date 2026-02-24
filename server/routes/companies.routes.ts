import { Router, Request, Response } from "express";
import { z } from "zod";
import { eq, and, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { companies } from "@shared/schema";
import { storage } from "../storage";
import { requireAuth, requireRole, requireSuperAdmin } from "./middleware/auth.middleware";
import { cloneSystemDefaultsToCompany } from "./system-defaults.routes";
import logger from "../lib/logger";

const router = Router();

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  code: z.string().min(1, "Company code is required").max(10),
  isActive: z.boolean().optional().default(true),
  cloneDefaultsFromCompanyId: z.string().optional(),
});

const inboxEmailsSchema = z.object({
  apInboxEmail: z.string().email("Invalid AP inbox email").max(255).nullable().optional(),
  tenderInboxEmail: z.string().email("Invalid tender inbox email").max(255).nullable().optional(),
  draftingInboxEmail: z.string().email("Invalid drafting inbox email").max(255).nullable().optional(),
});

async function validateInboxEmailUniqueness(
  emails: { apInboxEmail?: string | null; tenderInboxEmail?: string | null; draftingInboxEmail?: string | null },
  excludeCompanyId: string
): Promise<string | null> {
  const emailsToCheck: string[] = [];
  if (emails.apInboxEmail) emailsToCheck.push(emails.apInboxEmail.toLowerCase());
  if (emails.tenderInboxEmail) emailsToCheck.push(emails.tenderInboxEmail.toLowerCase());
  if (emails.draftingInboxEmail) emailsToCheck.push(emails.draftingInboxEmail.toLowerCase());

  const uniqueEmails = [...new Set(emailsToCheck)];
  if (uniqueEmails.length < emailsToCheck.length) {
    return "The same email address cannot be used for multiple inbox types";
  }

  for (const email of uniqueEmails) {
    const [conflict] = await db.select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(
        ne(companies.id, excludeCompanyId),
        or(
          eq(companies.apInboxEmail, email),
          eq(companies.tenderInboxEmail, email),
          eq(companies.draftingInboxEmail, email)
        )
      ))
      .limit(1);
    if (conflict) {
      return `Email address "${email}" is already in use by company "${conflict.name}"`;
    }
  }

  return null;
}

router.get("/api/admin/companies", requireSuperAdmin, async (req, res) => {
  try {
    const allCompanies = await storage.getAllCompanies();
    res.json(allCompanies);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/admin/companies/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.post("/api/admin/companies", requireSuperAdmin, async (req, res) => {
  try {
    const result = companySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const data = result.data;
    const existing = await storage.getCompanyByCode(data.code.toUpperCase());
    if (existing) {
      return res.status(400).json({ error: "Company code already exists" });
    }
    const company = await storage.createCompany({
      name: data.name,
      code: data.code.toUpperCase(),
      isActive: data.isActive,
    });

    let cloneResult = null;
    if (data.cloneDefaultsFromCompanyId) {
      try {
        const userId = (req as any).session?.userId;
        cloneResult = await cloneSystemDefaultsToCompany(data.cloneDefaultsFromCompanyId, company.id, userId);
      } catch (cloneError: any) {
        logger.error({ err: cloneError }, "Failed to clone defaults to new company");
      }
    }

    res.status(201).json({ ...company, cloneResult });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.issues });
    }
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.put("/api/admin/companies/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const result = companySchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const data = result.data;
    const updateData: Record<string, unknown> = { ...data };
    if (data.code) {
      updateData.code = data.code.toUpperCase();
    }
    const company = await storage.updateCompany(companyId, updateData);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.issues });
    }
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.delete("/api/admin/companies/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    if (companyId === "1") {
      return res.status(400).json({ error: "Cannot delete the default company" });
    }
    const companyUsers = await storage.getAllUsers(companyId);
    if (companyUsers.length > 0) {
      return res.status(400).json({ error: "Cannot delete company with existing users" });
    }
    await storage.deleteCompany(companyId);
    res.json({ ok: true });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.get("/api/settings/inbox-emails", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const [company] = await db.select({
      apInboxEmail: companies.apInboxEmail,
      tenderInboxEmail: companies.tenderInboxEmail,
      draftingInboxEmail: companies.draftingInboxEmail,
    }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

router.put("/api/settings/inbox-emails", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    const result = inboxEmailsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
    }

    const data = result.data;
    const normalized: Record<string, string | null> = {};
    if (data.apInboxEmail !== undefined) normalized.apInboxEmail = data.apInboxEmail ? data.apInboxEmail.toLowerCase().trim() : null;
    if (data.tenderInboxEmail !== undefined) normalized.tenderInboxEmail = data.tenderInboxEmail ? data.tenderInboxEmail.toLowerCase().trim() : null;
    if (data.draftingInboxEmail !== undefined) normalized.draftingInboxEmail = data.draftingInboxEmail ? data.draftingInboxEmail.toLowerCase().trim() : null;

    const conflictError = await validateInboxEmailUniqueness(normalized, companyId);
    if (conflictError) {
      return res.status(400).json({ error: conflictError });
    }

    const [updated] = await db.update(companies)
      .set({ ...normalized, updatedAt: new Date() })
      .where(eq(companies.id, companyId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({
      apInboxEmail: updated.apInboxEmail,
      tenderInboxEmail: updated.tenderInboxEmail,
      draftingInboxEmail: updated.draftingInboxEmail,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: "An internal error occurred" });
  }
});

export const companiesRouter = router;
