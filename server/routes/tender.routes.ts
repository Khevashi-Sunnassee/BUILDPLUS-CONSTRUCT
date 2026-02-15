import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { tenders, tenderPackages, tenderSubmissions, tenderLineItems, tenderLineActivities, tenderLineFiles, tenderLineRisks, tenderMembers, tenderNotes, tenderFiles, suppliers, users, jobs, costCodes, childCostCodes, budgetLines, jobBudgets, documents, documentBundles, documentBundleItems, jobTypes } from "@shared/schema";
import { eq, and, desc, asc, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import crypto from "crypto";
import QRCode from "qrcode";
import { emailService } from "../services/email.service";
import { buildBrandedEmail } from "../lib/email-template";
import OpenAI from "openai";
import { ObjectStorageService } from "../replit_integrations/object_storage";

const tenderUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const tenderObjectStorage = new ObjectStorageService();

const router = Router();

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(id: string): boolean { return uuidRegex.test(id); }

const EDITABLE_STATUSES = ["DRAFT", "OPEN", "UNDER_REVIEW"];

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["UNDER_REVIEW", "CLOSED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "OPEN", "CLOSED", "CANCELLED"],
  APPROVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: ["DRAFT"],
};

async function verifyTenderOwnership(companyId: string, tenderId: string, dbInstance?: typeof db): Promise<boolean> {
  const q = dbInstance || db;
  const [t] = await q.select({ id: tenders.id }).from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
  return !!t;
}

async function verifySubmissionOwnership(companyId: string, tenderId: string, submissionId: string, dbInstance?: typeof db): Promise<boolean> {
  const q = dbInstance || db;
  const [s] = await q.select({ id: tenderSubmissions.id }).from(tenderSubmissions).where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.tenderId, tenderId), eq(tenderSubmissions.companyId, companyId)));
  return !!s;
}

async function verifyTenderEditable(companyId: string, tenderId: string, dbInstance?: typeof db): Promise<{ editable: boolean; tender: Record<string, unknown> | null }> {
  const q = dbInstance || db;
  const [t] = await q.select({ id: tenders.id, status: tenders.status }).from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
  if (!t) return { editable: false, tender: null };
  return { editable: EDITABLE_STATUSES.includes(t.status), tender: t };
}

const tenderSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "OPEN", "UNDER_REVIEW", "APPROVED", "CLOSED", "CANCELLED"]).optional(),
  dueDate: z.string().nullable().optional(),
  openDate: z.string().nullable().optional(),
  closedDate: z.string().nullable().optional(),
  bundleId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const submissionSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  coverNote: z.string().nullable().optional(),
  status: z.enum(["SUBMITTED", "REVISED", "APPROVED", "REJECTED"]).optional(),
  subtotal: z.string().nullable().optional(),
  taxAmount: z.string().nullable().optional(),
  totalPrice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const lineItemSchema = z.object({
  costCodeId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.string().nullable().optional(),
  lineTotal: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

async function getNextTenderNumber(companyId: string, tx?: typeof db): Promise<string> {
  const queryDb = tx || db;
  const result = await queryDb
    .select({ tenderNumber: tenders.tenderNumber })
    .from(tenders)
    .where(eq(tenders.companyId, companyId))
    .orderBy(desc(tenders.tenderNumber))
    .limit(1);

  if (result.length === 0) {
    return "TDR-000001";
  }

  const lastNumber = result[0].tenderNumber;
  const match = lastNumber.match(/TDR-(\d+)/);
  if (match) {
    const next = parseInt(match[1], 10) + 1;
    return `TDR-${String(next).padStart(6, "0")}`;
  }
  return "TDR-000001";
}

const VALID_STATUSES = ["DRAFT", "OPEN", "UNDER_REVIEW", "APPROVED", "CLOSED", "CANCELLED"];

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

router.get("/api/tenders", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobId, status } = req.query;
    const { limit: queryLimit, offset: queryOffset } = paginationSchema.parse(req.query);

    let conditions = [eq(tenders.companyId, companyId)];

    if (jobId && typeof jobId === "string") {
      if (!isValidId(jobId)) return res.status(400).json({ message: "Invalid jobId format", code: "VALIDATION_ERROR" });
      conditions.push(eq(tenders.jobId, jobId));
    }
    if (status && typeof status === "string") {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, code: "VALIDATION_ERROR" });
      conditions.push(eq(tenders.status, status as any));
    }

    const memberCountSubquery = db
      .select({
        tenderId: tenderMembers.tenderId,
        count: sql<number>`count(*)::int`.as("member_count"),
      })
      .from(tenderMembers)
      .groupBy(tenderMembers.tenderId)
      .as("member_counts");

    const results = await db
      .select({
        tender: tenders,
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
        memberCount: sql<number>`coalesce(${memberCountSubquery.count}, 0)`.as("memberCount"),
      })
      .from(tenders)
      .leftJoin(jobs, eq(tenders.jobId, jobs.id))
      .leftJoin(users, eq(tenders.createdById, users.id))
      .leftJoin(memberCountSubquery, eq(tenders.id, memberCountSubquery.tenderId))
      .where(and(...conditions))
      .orderBy(desc(tenders.createdAt))
      .limit(queryLimit)
      .offset(queryOffset);

    const mapped = results.map((row) => ({
      ...row.tender,
      job: row.job,
      createdBy: row.createdBy,
      memberCount: row.memberCount,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tenders:", error);
    res.status(500).json({ message: "Failed to fetch tenders", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const result = await db
      .select({
        tender: tenders,
        job: {
          id: jobs.id,
          name: jobs.name,
          jobNumber: jobs.jobNumber,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenders)
      .leftJoin(jobs, eq(tenders.jobId, jobs.id))
      .leftJoin(users, eq(tenders.createdById, users.id))
      .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const members = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(eq(tenderMembers.tenderId, req.params.id), eq(tenderMembers.companyId, companyId)));

    const row = result[0];
    res.json({
      ...row.tender,
      job: row.job,
      createdBy: row.createdBy,
      members: members.map(m => ({ ...m.member, supplier: m.supplier })),
    });
  } catch (error: unknown) {
    logger.error("Error fetching tender:", error);
    res.status(500).json({ message: "Failed to fetch tender", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const data = tenderSchema.parse(req.body);
    const documentIds: string[] = Array.isArray(req.body.documentIds) ? req.body.documentIds : [];
    const memberIds: string[] = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

    const maxRetries = 3;
    let attempt = 0;
    let result: Record<string, unknown> | null = null;

    if (data.openDate && data.closedDate && new Date(data.closedDate) < new Date(data.openDate)) {
      return res.status(400).json({ message: "Closed Date cannot be before Open Date" });
    }

    while (attempt < maxRetries) {
      attempt++;
      try {
        result = await db.transaction(async (tx) => {
          const tenderNumber = await getNextTenderNumber(companyId, tx);

          const [tender] = await tx
            .insert(tenders)
            .values({
              companyId,
              jobId: data.jobId,
              tenderNumber,
              title: data.title,
              description: data.description || null,
              status: data.status || "DRAFT",
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
              openDate: data.openDate ? new Date(data.openDate) : null,
              closedDate: data.closedDate ? new Date(data.closedDate) : null,
              bundleId: data.bundleId || null,
              notes: data.notes || null,
              createdById: userId,
            })
            .returning();

          if (data.bundleId) {
            const [validBundle] = await tx.select({ id: documentBundles.id, bundleName: documentBundles.bundleName })
              .from(documentBundles)
              .where(and(eq(documentBundles.id, data.bundleId), eq(documentBundles.companyId, companyId)));
            if (validBundle) {
              await tx.insert(tenderPackages).values({
                companyId,
                tenderId: tender.id,
                bundleId: validBundle.id,
                name: validBundle.bundleName || `Tender Documents - ${data.title}`,
                description: `Document bundle attached`,
                sortOrder: 0,
              });
            }
          }

          if (documentIds.length > 0) {
            const validDocs = await tx.select({ id: documents.id })
              .from(documents)
              .where(and(
                inArray(documents.id, documentIds),
                eq(documents.companyId, companyId)
              ));
            const validDocIds = validDocs.map(d => d.id);

            if (validDocIds.length > 0) {
              const qrCodeId = `bundle-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
              const [bundle] = await tx.insert(documentBundles).values({
                companyId,
                bundleName: `Tender ${tenderNumber} - ${data.title}`,
                description: `Document bundle for tender ${tenderNumber}`,
                qrCodeId,
                jobId: data.jobId,
                isPublic: false,
                allowGuestAccess: false,
                createdBy: userId,
              }).returning();

              if (validDocIds.length > 0) {
                await tx.insert(documentBundleItems).values(
                  validDocIds.map((docId, i) => ({
                    bundleId: bundle.id,
                    documentId: docId,
                    sortOrder: i,
                    addedBy: userId,
                  }))
                );
              }

              await tx.insert(tenderPackages).values({
                companyId,
                tenderId: tender.id,
                bundleId: bundle.id,
                name: `Tender Documents - ${data.title}`,
                description: `${validDocIds.length} document(s) attached`,
                sortOrder: data.bundleId ? 1 : 0,
              });
            }
          }

          if (memberIds.length > 0) {
            const validSuppliers = await tx.select({ id: suppliers.id })
              .from(suppliers)
              .where(and(
                inArray(suppliers.id, memberIds),
                eq(suppliers.companyId, companyId)
              ));
            const validSupplierIds = validSuppliers.map(s => s.id);

            if (validSupplierIds.length > 0) {
              await tx.insert(tenderMembers).values(
                validSupplierIds.map(supplierId => ({
                  companyId,
                  tenderId: tender.id,
                  supplierId,
                  status: "PENDING",
                  invitedAt: new Date(),
                }))
              );
            }
          }

          return tender;
        });
        break;
      } catch (txError: unknown) {
        if ((txError as { code?: string; constraint?: string }).code === "23505" && (txError as { code?: string; constraint?: string }).constraint === "tenders_number_company_idx" && attempt < maxRetries) {
          logger.warn(`Tender number collision on attempt ${attempt}, retrying...`);
          continue;
        }
        throw txError;
      }
    }

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender:", error);
    res.status(500).json({ message: "Failed to create tender", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });
    const data = tenderSchema.partial().parse(req.body);

    if (data.status !== undefined) {
      const [currentTender] = await db.select({ id: tenders.id, status: tenders.status }).from(tenders).where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)));
      if (!currentTender) {
        return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
      }
      const allowed = VALID_TRANSITIONS[currentTender.status] || [];
      if (!allowed.includes(data.status)) {
        return res.status(400).json({ message: `Cannot transition from ${currentTender.status} to ${data.status}`, code: "STATUS_LOCKED" });
      }
    }

    const effectiveOpenDate = data.openDate !== undefined ? data.openDate : (currentTender.openDate ? currentTender.openDate.toISOString() : null);
    const effectiveClosedDate = data.closedDate !== undefined ? data.closedDate : (currentTender.closedDate ? currentTender.closedDate.toISOString() : null);
    if (effectiveOpenDate && effectiveClosedDate && new Date(effectiveClosedDate) < new Date(effectiveOpenDate)) {
      return res.status(400).json({ message: "Closed Date cannot be before Open Date" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.jobId !== undefined) updateData.jobId = data.jobId;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.openDate !== undefined) updateData.openDate = data.openDate ? new Date(data.openDate) : null;
    if (data.closedDate !== undefined) updateData.closedDate = data.closedDate ? new Date(data.closedDate) : null;
    if (data.bundleId !== undefined) updateData.bundleId = data.bundleId || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const memberIds: string[] | undefined = Array.isArray(req.body.memberIds) ? req.body.memberIds : undefined;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tenders)
        .set(updateData)
        .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
        .returning();

      if (!updated) {
        return null;
      }

      if (data.bundleId !== undefined) {
        const existingBundlePkgs = await tx.select({ id: tenderPackages.id, bundleId: tenderPackages.bundleId })
          .from(tenderPackages)
          .where(and(
            eq(tenderPackages.tenderId, req.params.id),
            eq(tenderPackages.companyId, companyId),
            isNotNull(tenderPackages.bundleId),
            isNull(tenderPackages.documentId),
          ));

        if (existingBundlePkgs.length > 0) {
          const oldBundleLinkedToTenderField = existingBundlePkgs.find(p => p.bundleId === currentTender.bundleId);
          if (oldBundleLinkedToTenderField) {
            await tx.delete(tenderPackages).where(eq(tenderPackages.id, oldBundleLinkedToTenderField.id));
          }
        }

        if (data.bundleId) {
          const [validBundle] = await tx.select({ id: documentBundles.id, bundleName: documentBundles.bundleName })
            .from(documentBundles)
            .where(and(eq(documentBundles.id, data.bundleId), eq(documentBundles.companyId, companyId)));
          if (validBundle) {
            const alreadyLinked = existingBundlePkgs.some(p => p.bundleId === data.bundleId);
            if (!alreadyLinked) {
              await tx.insert(tenderPackages).values({
                companyId,
                tenderId: req.params.id,
                bundleId: validBundle.id,
                name: validBundle.bundleName || `Tender Documents`,
                description: `Document bundle attached`,
                sortOrder: 0,
              });
            }
          }
        }
      }

      if (memberIds !== undefined) {
        await tx.delete(tenderMembers).where(and(eq(tenderMembers.tenderId, req.params.id), eq(tenderMembers.companyId, companyId)));

        if (memberIds.length > 0) {
          const validSuppliers = await tx.select({ id: suppliers.id })
            .from(suppliers)
            .where(and(
              inArray(suppliers.id, memberIds),
              eq(suppliers.companyId, companyId)
            ));
          const validSupplierIds = validSuppliers.map(s => s.id);

          for (const supplierId of validSupplierIds) {
            await tx.insert(tenderMembers).values({
              companyId,
              tenderId: req.params.id,
              supplierId,
              status: "PENDING",
              invitedAt: new Date(),
            });
          }
        }
      }

      return updated;
    });

    if (!result) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender:", error);
    res.status(500).json({ message: "Failed to update tender", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/tenders/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const submissions = await db
      .select({ id: tenderSubmissions.id })
      .from(tenderSubmissions)
      .where(and(eq(tenderSubmissions.tenderId, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .limit(1);

    if (submissions.length > 0) {
      return res.status(400).json({ message: "Cannot delete tender with existing submissions", code: "VALIDATION_ERROR" });
    }

    const [deleted] = await db
      .delete(tenders)
      .where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    res.json({ message: "Tender deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error("Error deleting tender:", error);
    res.status(500).json({ message: "Failed to delete tender", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, req.params.tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        submission: tenderSubmissions,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenderSubmissions)
      .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
      .leftJoin(users, eq(tenderSubmissions.createdById, users.id))
      .where(and(eq(tenderSubmissions.tenderId, req.params.tenderId), eq(tenderSubmissions.companyId, companyId)))
      .orderBy(desc(tenderSubmissions.createdAt))
      .limit(50);

    const mapped = results.map((row) => ({
      ...row.submission,
      supplier: row.supplier,
      createdBy: row.createdBy,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender submissions:", error);
    res.status(500).json({ message: "Failed to fetch tender submissions", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    if (!isValidId(req.params.tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });
    const data = submissionSchema.parse(req.body);

    const { editable, tender } = await verifyTenderEditable(companyId, req.params.tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, data.supplierId), eq(suppliers.companyId, companyId)));
    if (!supplier) return res.status(400).json({ message: "Supplier not found", code: "VALIDATION_ERROR" });

    const [result] = await db
      .insert(tenderSubmissions)
      .values({
        companyId,
        tenderId: req.params.tenderId,
        supplierId: data.supplierId,
        coverNote: data.coverNote || null,
        status: data.status || "SUBMITTED",
        subtotal: data.subtotal || "0",
        taxAmount: data.taxAmount || "0",
        totalPrice: data.totalPrice || "0",
        notes: data.notes || null,
        createdById: userId,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender submission:", error);
    res.status(500).json({ message: "Failed to create tender submission", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.id))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = submissionSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.coverNote !== undefined) updateData.coverNote = data.coverNote || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal || "0";
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount || "0";
    if (data.totalPrice !== undefined) updateData.totalPrice = data.totalPrice || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const [result] = await db
      .update(tenderSubmissions)
      .set(updateData)
      .where(and(eq(tenderSubmissions.id, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender submission not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender submission:", error);
    res.status(500).json({ message: "Failed to update tender submission", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:id/approve", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.id))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const [result] = await db
      .update(tenderSubmissions)
      .set({
        status: "APPROVED",
        approvedById: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tenderSubmissions.id, req.params.id), eq(tenderSubmissions.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "Tender submission not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    logger.error("Error approving tender submission:", error);
    res.status(500).json({ message: "Failed to approve tender submission", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.tenderId) || !isValidId(req.params.submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifySubmissionOwnership(companyId, req.params.tenderId, req.params.submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        lineItem: tenderLineItems,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
      })
      .from(tenderLineItems)
      .leftJoin(costCodes, eq(tenderLineItems.costCodeId, costCodes.id))
      .where(and(eq(tenderLineItems.tenderSubmissionId, req.params.submissionId), eq(tenderLineItems.companyId, companyId)))
      .orderBy(asc(tenderLineItems.sortOrder))
      .limit(500);

    const mapped = results.map((row) => ({
      ...row.lineItem,
      costCode: row.costCode,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender line items:", error);
    res.status(500).json({ message: "Failed to fetch tender line items", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:tenderId/submissions/:submissionId/line-items", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = lineItemSchema.parse(req.body);

    const result = await db.transaction(async (tx) => {
      const [lineItem] = await tx
        .insert(tenderLineItems)
        .values({
          companyId,
          tenderSubmissionId: submissionId,
          costCodeId: data.costCodeId || null,
          description: data.description,
          quantity: data.quantity || "1",
          unit: data.unit || "EA",
          unitPrice: data.unitPrice || "0",
          lineTotal: data.lineTotal || "0",
          notes: data.notes || null,
          sortOrder: data.sortOrder ?? 0,
        })
        .returning();

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return lineItem;
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error creating tender line item:", error);
    res.status(500).json({ message: "Failed to create tender line item", code: "INTERNAL_ERROR" });
  }
});

router.patch("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId, id } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId) || !isValidId(id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const data = lineItemSchema.partial().parse(req.body);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.quantity !== undefined) updateData.quantity = data.quantity || "1";
    if (data.unit !== undefined) updateData.unit = data.unit || "EA";
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice || "0";
    if (data.lineTotal !== undefined) updateData.lineTotal = data.lineTotal || "0";
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const result = await db.transaction(async (tx) => {
      const [lineItem] = await tx
        .update(tenderLineItems)
        .set(updateData)
        .where(and(eq(tenderLineItems.id, id), eq(tenderLineItems.companyId, companyId)))
        .returning();

      if (!lineItem) return null;

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return lineItem;
    });

    if (!result) {
      return res.status(404).json({ message: "Tender line item not found", code: "NOT_FOUND" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error updating tender line item:", error);
    res.status(500).json({ message: "Failed to update tender line item", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/tenders/:tenderId/submissions/:submissionId/line-items/:id", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, submissionId, id } = req.params;
    if (!isValidId(tenderId) || !isValidId(submissionId) || !isValidId(id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender } = await verifyTenderEditable(companyId, tenderId);
    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tender.status}`, code: "STATUS_LOCKED" });
    }

    if (!(await verifySubmissionOwnership(companyId, tenderId, submissionId))) {
      return res.status(403).json({ message: "Submission not found or access denied", code: "FORBIDDEN" });
    }

    const result = await db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(tenderLineItems)
        .where(and(eq(tenderLineItems.id, id), eq(tenderLineItems.companyId, companyId)))
        .returning();

      if (!deleted) return null;

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(eq(tenderLineItems.tenderSubmissionId, submissionId), eq(tenderLineItems.companyId, companyId)));
      await tx.update(tenderSubmissions).set({ totalPrice: totalResult[0]?.total || "0", subtotal: totalResult[0]?.total || "0", updatedAt: new Date() })
        .where(and(eq(tenderSubmissions.id, submissionId), eq(tenderSubmissions.companyId, companyId)));

      return deleted;
    });

    if (!result) {
      return res.status(404).json({ message: "Tender line item not found", code: "NOT_FOUND" });
    }
    res.json({ message: "Tender line item deleted", id: result.id });
  } catch (error: unknown) {
    logger.error("Error deleting tender line item:", error);
    res.status(500).json({ message: "Failed to delete tender line item", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/jobs/:jobId/tenders", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    if (!isValidId(jobId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const results = await db
      .select({
        tender: tenders,
        createdBy: {
          id: users.id,
          name: users.name,
        },
      })
      .from(tenders)
      .leftJoin(users, eq(tenders.createdById, users.id))
      .where(and(eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)))
      .orderBy(desc(tenders.createdAt))
      .limit(100);

    const tenderIds = results.map(r => r.tender.id);
    let submissionsByTender: Record<string, any[]> = {};

    if (tenderIds.length > 0) {
      const allSubmissions = await db
        .select({
          submission: tenderSubmissions,
          supplier: {
            id: suppliers.id,
            name: suppliers.name,
          },
        })
        .from(tenderSubmissions)
        .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
        .where(and(
          inArray(tenderSubmissions.tenderId, tenderIds),
          eq(tenderSubmissions.companyId, companyId),
        ))
        .orderBy(desc(tenderSubmissions.createdAt));

      for (const row of allSubmissions) {
        const tid = row.submission.tenderId;
        if (!submissionsByTender[tid]) submissionsByTender[tid] = [];
        submissionsByTender[tid].push({
          ...row.submission,
          supplier: row.supplier,
        });
      }
    }

    const mapped = results.map((row) => ({
      ...row.tender,
      createdBy: row.createdBy,
      submissions: submissionsByTender[row.tender.id] || [],
      submissionCount: (submissionsByTender[row.tender.id] || []).length,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching job tenders:", error);
    res.status(500).json({ message: "Failed to fetch job tenders", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/jobs/:jobId/tenders/:tenderId/sheet", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = req.params.jobId;
    const tenderId = req.params.tenderId;
    if (!isValidId(jobId) || !isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({
        id: tenders.id,
        jobId: tenders.jobId,
        tenderNumber: tenders.tenderNumber,
        title: tenders.title,
        description: tenders.description,
        status: tenders.status,
        dueDate: tenders.dueDate,
        notes: tenders.notes,
        companyId: tenders.companyId,
        createdById: tenders.createdById,
        createdAt: tenders.createdAt,
      })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const [budget] = await db
      .select({ id: jobBudgets.id })
      .from(jobBudgets)
      .where(and(eq(jobBudgets.jobId, jobId), eq(jobBudgets.companyId, companyId)));

    if (!budget) {
      return res.json({ tender, budgetLines: [], submissions: [], lineItems: {} });
    }

    const lines = await db
      .select({
        line: budgetLines,
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
        childCostCode: {
          id: childCostCodes.id,
          code: childCostCodes.code,
          name: childCostCodes.name,
        },
      })
      .from(budgetLines)
      .innerJoin(costCodes, eq(budgetLines.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(budgetLines.childCostCodeId, childCostCodes.id))
      .where(and(eq(budgetLines.budgetId, budget.id), eq(budgetLines.companyId, companyId)))
      .orderBy(asc(budgetLines.sortOrder));

    const submissions = await db
      .select({
        submission: tenderSubmissions,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(tenderSubmissions)
      .leftJoin(suppliers, eq(tenderSubmissions.supplierId, suppliers.id))
      .where(and(eq(tenderSubmissions.tenderId, tenderId), eq(tenderSubmissions.companyId, companyId)))
      .orderBy(desc(tenderSubmissions.createdAt));

    const submissionIds = submissions.map(s => s.submission.id);
    let lineItemsBySubmission: Record<string, any[]> = {};

    if (submissionIds.length > 0) {
      const allLineItems = await db
        .select({
          id: tenderLineItems.id,
          tenderSubmissionId: tenderLineItems.tenderSubmissionId,
          costCodeId: tenderLineItems.costCodeId,
          childCostCodeId: tenderLineItems.childCostCodeId,
          lineTotal: tenderLineItems.lineTotal,
          unitPrice: tenderLineItems.unitPrice,
          quantity: tenderLineItems.quantity,
          unit: tenderLineItems.unit,
          sortOrder: tenderLineItems.sortOrder,
        })
        .from(tenderLineItems)
        .where(and(
          inArray(tenderLineItems.tenderSubmissionId, submissionIds),
          eq(tenderLineItems.companyId, companyId),
        ))
        .orderBy(asc(tenderLineItems.sortOrder));

      for (const item of allLineItems) {
        if (!lineItemsBySubmission[item.tenderSubmissionId]) {
          lineItemsBySubmission[item.tenderSubmissionId] = [];
        }
        lineItemsBySubmission[item.tenderSubmissionId].push(item);
      }
    }

    const mappedLines = lines.map((row) => ({
      ...row.line,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    const mappedSubmissions = submissions.map((row) => ({
      ...row.submission,
      supplier: row.supplier,
      lineItems: lineItemsBySubmission[row.submission.id] || [],
    }));

    const packages = await db
      .select({
        pkg: tenderPackages,
        document: {
          id: documents.id,
          title: documents.title,
          documentNumber: documents.documentNumber,
          fileName: documents.fileName,
        },
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder));

    const mappedPackages = packages.map(p => ({
      ...p.pkg,
      document: p.document?.id ? p.document : null,
      bundle: p.bundle?.id ? p.bundle : null,
    }));

    res.json({
      tender,
      budgetLines: mappedLines,
      submissions: mappedSubmissions,
      documents: mappedPackages,
    });
  } catch (error: unknown) {
    logger.error("Error fetching tender sheet:", error);
    res.status(500).json({ message: "Failed to fetch tender sheet", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/submissions/:submissionId/upsert-lines", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { submissionId, tenderId, jobId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId) || !isValidId(submissionId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender: tenderRecord } = await verifyTenderEditable(companyId, tenderId);
    if (!tenderRecord) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tenderRecord.status}`, code: "STATUS_LOCKED" });
    }

    const [submission] = await db
      .select({ id: tenderSubmissions.id })
      .from(tenderSubmissions)
      .where(and(
        eq(tenderSubmissions.id, submissionId),
        eq(tenderSubmissions.tenderId, tenderId),
        eq(tenderSubmissions.companyId, companyId),
      ));

    if (!submission) {
      return res.status(404).json({ message: "Submission not found", code: "NOT_FOUND" });
    }

    const schema = z.object({
      lines: z.array(z.object({
        costCodeId: z.string(),
        childCostCodeId: z.string().nullable().optional(),
        amount: z.string(),
      })),
    });

    const { lines } = schema.parse(req.body);

    let finalTotalPrice = "0";

    await db.transaction(async (tx) => {
      const existingItems = await tx
        .select()
        .from(tenderLineItems)
        .where(and(
          eq(tenderLineItems.tenderSubmissionId, submissionId),
          eq(tenderLineItems.companyId, companyId),
        ));

      const existingMap = new Map<string, typeof existingItems[0]>();
      for (const item of existingItems) {
        const key = `${item.costCodeId || ""}:${item.childCostCodeId || ""}`;
        existingMap.set(key, item);
      }

      for (const line of lines) {
        const amount = parseFloat(line.amount) || 0;
        const key = `${line.costCodeId}:${line.childCostCodeId || ""}`;
        const existing = existingMap.get(key);

        if (amount === 0 && existing) {
          await tx.delete(tenderLineItems).where(eq(tenderLineItems.id, existing.id));
        } else if (amount !== 0 && existing) {
          await tx.update(tenderLineItems)
            .set({
              lineTotal: String(amount),
              unitPrice: String(amount),
              updatedAt: new Date(),
            })
            .where(eq(tenderLineItems.id, existing.id));
        } else if (amount !== 0) {
          await tx.insert(tenderLineItems).values({
            companyId,
            tenderSubmissionId: submissionId,
            costCodeId: line.costCodeId,
            childCostCodeId: line.childCostCodeId || null,
            description: "Tender amount",
            quantity: "1",
            unit: "EA",
            unitPrice: String(amount),
            lineTotal: String(amount),
          });
        }
      }

      const totalResult = await tx
        .select({ total: sql<string>`coalesce(sum(cast(${tenderLineItems.lineTotal} as numeric)), 0)::text` })
        .from(tenderLineItems)
        .where(and(
          eq(tenderLineItems.tenderSubmissionId, submissionId),
          eq(tenderLineItems.companyId, companyId),
        ));
      finalTotalPrice = totalResult[0]?.total || "0";

      await tx.update(tenderSubmissions)
        .set({
          totalPrice: finalTotalPrice,
          subtotal: finalTotalPrice,
          updatedAt: new Date(),
        })
        .where(and(
          eq(tenderSubmissions.id, submissionId),
          eq(tenderSubmissions.companyId, companyId),
        ));
    });

    res.json({ message: "Lines updated", totalPrice: finalTotalPrice });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error upserting tender lines:", error);
    res.status(500).json({ message: "Failed to update tender lines", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/jobs/:jobId/tenders/:tenderId/documents", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const { editable, tender: tenderRecord } = await verifyTenderEditable(companyId, tenderId);
    if (!tenderRecord) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }
    if (!editable) {
      return res.status(400).json({ message: `Cannot modify a tender with status: ${tenderRecord.status}`, code: "STATUS_LOCKED" });
    }

    const [tenderJobCheck] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tenderJobCheck) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const schema = z.object({
      bundleId: z.string().min(1, "Bundle is required"),
    });

    const data = schema.parse(req.body);

    const [bundle] = await db
      .select({ id: documentBundles.id, bundleName: documentBundles.bundleName })
      .from(documentBundles)
      .where(and(eq(documentBundles.id, data.bundleId), eq(documentBundles.companyId, companyId)));

    if (!bundle) {
      return res.status(404).json({ message: "Document bundle not found", code: "NOT_FOUND" });
    }

    const existing = await db
      .select({ id: tenderPackages.id })
      .from(tenderPackages)
      .where(and(
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.bundleId, data.bundleId),
        eq(tenderPackages.companyId, companyId),
      ));

    if (existing.length > 0) {
      return res.status(400).json({ message: "This bundle is already attached to this tender", code: "DUPLICATE" });
    }

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${tenderPackages.sortOrder}), -1)` })
      .from(tenderPackages)
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)));

    const [pkg] = await db.insert(tenderPackages).values({
      companyId,
      tenderId,
      bundleId: data.bundleId,
      name: bundle.bundleName,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
    }).returning();

    res.json(pkg);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error adding tender document:", error);
    res.status(500).json({ message: "Failed to add tender document", code: "INTERNAL_ERROR" });
  }
});

router.delete("/api/jobs/:jobId/tenders/:tenderId/documents/:packageId", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { tenderId, jobId, packageId } = req.params;
    if (!isValidId(jobId) || !isValidId(tenderId) || !isValidId(packageId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({ id: tenders.id })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.jobId, jobId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    await db.delete(tenderPackages)
      .where(and(
        eq(tenderPackages.id, packageId),
        eq(tenderPackages.tenderId, tenderId),
        eq(tenderPackages.companyId, companyId),
      ));

    res.json({ message: "Document removed from tender" });
  } catch (error: unknown) {
    logger.error("Error removing tender document:", error);
    res.status(500).json({ message: "Failed to remove tender document", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id/members", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, req.params.id))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
          phone: suppliers.phone,
          keyContact: suppliers.keyContact,
          defaultCostCodeId: suppliers.defaultCostCodeId,
        },
        costCode: {
          id: costCodes.id,
          code: costCodes.code,
          name: costCodes.name,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .leftJoin(costCodes, eq(suppliers.defaultCostCodeId, costCodes.id))
      .where(and(eq(tenderMembers.tenderId, req.params.id), eq(tenderMembers.companyId, companyId)));

    const mapped = results.map((row) => ({
      ...row.member,
      supplier: row.supplier,
      costCode: row.costCode?.id ? row.costCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender members:", error);
    res.status(500).json({ message: "Failed to fetch tender members", code: "INTERNAL_ERROR" });
  }
});

router.get("/api/tenders/:id/packages", requireAuth, requirePermission("tenders", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const results = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
        },
        document: {
          id: documents.id,
          title: documents.title,
          documentNumber: documents.documentNumber,
          version: documents.version,
          revision: documents.revision,
          isLatestVersion: documents.isLatestVersion,
          status: documents.status,
          fileName: documents.fileName,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder));

    const mapped: any[] = [];

    for (const r of results) {
      if (r.document?.id) {
        mapped.push({
          ...r.pkg,
          bundle: r.bundle?.id ? r.bundle : null,
          document: { ...r.document, isStale: r.document.isLatestVersion === false },
        });
      } else if (r.bundle?.id) {
        const bundleDocs = await db
          .select({
            bundleItem: documentBundleItems,
            document: {
              id: documents.id,
              title: documents.title,
              documentNumber: documents.documentNumber,
              version: documents.version,
              revision: documents.revision,
              isLatestVersion: documents.isLatestVersion,
              status: documents.status,
              fileName: documents.fileName,
            },
          })
          .from(documentBundleItems)
          .innerJoin(documents, eq(documentBundleItems.documentId, documents.id))
          .where(eq(documentBundleItems.bundleId, r.bundle.id))
          .orderBy(asc(documentBundleItems.sortOrder));

        if (bundleDocs.length > 0) {
          for (const bd of bundleDocs) {
            mapped.push({
              ...r.pkg,
              id: `${r.pkg.id}-${bd.document.id}`,
              bundle: r.bundle,
              document: { ...bd.document, isStale: bd.document.isLatestVersion === false },
            });
          }
        } else {
          mapped.push({
            ...r.pkg,
            bundle: r.bundle,
            document: null,
          });
        }
      } else {
        mapped.push({
          ...r.pkg,
          bundle: null,
          document: null,
        });
      }
    }

    res.json(mapped);
  } catch (error: unknown) {
    logger.error("Error fetching tender packages:", error);
    res.status(500).json({ message: "Failed to fetch tender packages", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/send-invitations", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
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
      memberIds: z.array(z.string()).min(1, "At least one member is required"),
      subject: z.string().min(1, "Subject is required"),
      message: z.string().min(1, "Message is required"),
    });

    const data = schema.parse(req.body);

    const members = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(
        inArray(tenderMembers.id, data.memberIds),
        eq(tenderMembers.tenderId, tenderId),
        eq(tenderMembers.companyId, companyId),
      ));

    const packages = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder));

    const seenBundleIds = new Set<string>();
    const bundlesWithQr = packages
      .filter(p => {
        if (!p.bundle?.id || !p.bundle?.qrCodeId) return false;
        if (seenBundleIds.has(p.bundle.id)) return false;
        seenBundleIds.add(p.bundle.id);
        return true;
      })
      .map(p => ({
        bundleName: p.bundle!.bundleName,
        qrCodeId: p.bundle!.qrCodeId,
        description: p.bundle!.description,
      }));

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const qrDataUrls: Record<string, string> = {};
    for (const bundle of bundlesWithQr) {
      try {
        const bundleUrl = `${baseUrl}/bundle/${bundle.qrCodeId}`;
        const qrDataUrl = await QRCode.toDataURL(bundleUrl, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        qrDataUrls[bundle.qrCodeId] = qrDataUrl;
      } catch (qrErr) {
        logger.warn({ err: qrErr, qrCodeId: bundle.qrCodeId }, "Failed to generate QR code for bundle");
      }
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ memberId: string; supplierName: string | null; status: string; error?: string }> = [];

    for (const row of members) {
      const email = row.supplier?.email;
      if (!email) {
        failed++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "failed", error: "No email address" });
        continue;
      }

      try {
        let bundleSection = "";
        if (bundlesWithQr.length > 0) {
          const bundleItems = bundlesWithQr.map(bundle => {
            const bundleUrl = `${baseUrl}/bundle/${bundle.qrCodeId}`;
            const qrImg = qrDataUrls[bundle.qrCodeId]
              ? `<div style="margin: 12px 0; text-align: center;"><img src="${qrDataUrls[bundle.qrCodeId]}" alt="QR Code for ${bundle.bundleName}" width="180" height="180" style="border: 1px solid #e0e0e0; border-radius: 8px;" /></div>`
              : "";
            return `
              <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                <h3 style="margin: 0 0 8px 0; color: #1a1a1a; font-size: 16px;">${bundle.bundleName}</h3>
                ${bundle.description ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">${bundle.description}</p>` : ""}
                ${qrImg}
                <div style="text-align: center; margin-top: 12px;">
                  <a href="${bundleUrl}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View Tender Documents</a>
                </div>
                <p style="margin: 12px 0 0 0; text-align: center; font-size: 12px; color: #888;">
                  Or copy this link: <a href="${bundleUrl}" style="color: #2563eb; word-break: break-all;">${bundleUrl}</a>
                </p>
              </div>`;
          }).join("");

          bundleSection = `
            <div style="margin-top: 24px; border-top: 2px solid #2563eb; padding-top: 20px;">
              <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 18px;">Tender Document${bundlesWithQr.length > 1 ? "s" : ""}</h2>
              <p style="margin: 0 0 16px 0; color: #555; font-size: 14px;">Please review the following document${bundlesWithQr.length > 1 ? " bundles" : " bundle"} for this tender. You can scan the QR code or click the link below to access the documents.</p>
              ${bundleItems}
            </div>`;
        }

        const htmlBody = await buildBrandedEmail({
          title: "Tender Invitation",
          recipientName: row.supplier?.name || undefined,
          body: `<div style="margin-bottom: 24px;">
              ${data.message.replace(/\n/g, "<br>")}
            </div>
            ${bundleSection}`,
          companyId,
        });

        await emailService.sendEmailWithAttachment({ to: email, subject: data.subject, body: htmlBody });

        await db.update(tenderMembers)
          .set({ status: "SENT", sentAt: new Date() })
          .where(eq(tenderMembers.id, row.member.id));

        sent++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "sent" });
      } catch (emailError: unknown) {
        failed++;
        results.push({ memberId: row.member.id, supplierName: row.supplier?.name || null, status: "failed", error: emailError instanceof Error ? emailError.message : "Send failed" });
      }
    }

    res.json({ sent, failed, results, bundlesIncluded: bundlesWithQr.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending tender invitations:", error);
    res.status(500).json({ message: "Failed to send invitations", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/notify-doc-updates", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      changedDocuments: z.array(z.object({
        documentTitle: z.string(),
        documentNumber: z.string().optional(),
        oldVersion: z.string().optional(),
        newVersion: z.string().optional(),
      })).min(1),
      newDocumentId: z.string().optional(),
      supersededDocumentId: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [tender] = await db.select().from(tenders).where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));
    if (!tender) return res.status(404).json({ message: "Tender not found" });

    const members = await db
      .select({ member: tenderMembers, supplier: { id: suppliers.id, name: suppliers.name, email: suppliers.email } })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(eq(tenderMembers.tenderId, tenderId), eq(tenderMembers.companyId, companyId)));

    let sent = 0;
    let failed = 0;
    const results: Array<{ supplierName: string | null; status: string; error?: string }> = [];

    const docListHtml = data.changedDocuments.map(d =>
      `<li><strong>${d.documentTitle}</strong>${d.documentNumber ? ` (${d.documentNumber})` : ""}${d.oldVersion && d.newVersion ? ` — updated from v${d.oldVersion} to v${d.newVersion}` : ""}</li>`
    ).join("");

    for (const row of members) {
      const email = row.supplier?.email;
      if (!email) { failed++; results.push({ supplierName: row.supplier?.name || null, status: "failed", error: "No email" }); continue; }

      try {
        const htmlBody = await buildBrandedEmail({
          title: "Document Update Notice",
          recipientName: row.supplier?.name || "Supplier",
          body: `<p>Please be advised that the following documents have been updated for tender <strong>${tender.tenderNumber} - ${tender.title}</strong>:</p>
          <ul>${docListHtml}</ul>
          <p>Please ensure you are referencing the latest versions when preparing your submission.</p>`,
          companyId,
        });

        await emailService.sendEmailWithAttachment({ to: email, subject: `Document Update - Tender ${tender.tenderNumber}: ${tender.title}`, body: htmlBody });
        sent++;
        results.push({ supplierName: row.supplier?.name || null, status: "sent" });
      } catch (emailError: unknown) {
        failed++;
        results.push({ supplierName: row.supplier?.name || null, status: "failed", error: emailError instanceof Error ? emailError.message : "Send failed" });
      }
    }

    res.json({ sent, failed, results });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending document update notifications:", error);
    res.status(500).json({ message: "Failed to send notifications", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/duplicate-package", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id as string;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const schema = z.object({
      supersededDocumentId: z.string(),
      newDocumentId: z.string(),
      copyExisting: z.boolean().default(true),
    });
    const data = schema.parse(req.body);

    const packages = await db
      .select({ pkg: tenderPackages, bundle: { id: documentBundles.id, bundleName: documentBundles.bundleName } })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)));

    let updatedDirectCount = 0;
    let updatedBundleCount = 0;

    for (const pkg of packages) {
      if (pkg.pkg.documentId === data.supersededDocumentId) {
        await db.update(tenderPackages)
          .set({ documentId: data.newDocumentId })
          .where(eq(tenderPackages.id, pkg.pkg.id));
        updatedDirectCount++;
      }

      if (pkg.pkg.bundleId) {
        const bundleItems = await db
          .select()
          .from(documentBundleItems)
          .where(and(eq(documentBundleItems.bundleId, pkg.pkg.bundleId), eq(documentBundleItems.documentId, data.supersededDocumentId)));

        for (const item of bundleItems) {
          await db.update(documentBundleItems)
            .set({ documentId: data.newDocumentId })
            .where(eq(documentBundleItems.id, item.id));
          updatedBundleCount++;
        }
      }
    }

    const updatedPackages = await db
      .select({ pkg: tenderPackages, document: { id: documents.id, title: documents.title, documentNumber: documents.documentNumber }, bundle: { id: documentBundles.id, bundleName: documentBundles.bundleName } })
      .from(tenderPackages)
      .leftJoin(documents, eq(tenderPackages.documentId, documents.id))
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), eq(tenderPackages.companyId, companyId)))
      .orderBy(asc(tenderPackages.sortOrder));

    const mapped = updatedPackages.map(p => ({
      ...p.pkg,
      document: p.document?.id ? p.document : null,
      bundle: p.bundle?.id ? p.bundle : null,
    }));

    res.json({ message: "Package updated successfully", updatedDirectCount, updatedBundleCount, packages: mapped });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error duplicating tender package:", error);
    res.status(500).json({ message: "Failed to update tender package", code: "INTERNAL_ERROR" });
  }
});

function calculateSearchRadius(jobTypeName: string, estimatedValue: number): { searchRadiusKm: number; projectScale: string } {
  const jobTypeNameLower = jobTypeName.toLowerCase();
  let searchRadiusKm = 40;
  let projectScale = "Medium";

  const isSmallResidential = jobTypeNameLower.includes("residential") ||
    jobTypeNameLower.includes("house") ||
    jobTypeNameLower.includes("renovation") ||
    jobTypeNameLower.includes("extension") ||
    jobTypeNameLower.includes("duplex");

  const isLargeProject = jobTypeNameLower.includes("high-rise") ||
    jobTypeNameLower.includes("highrise") ||
    jobTypeNameLower.includes("high rise") ||
    jobTypeNameLower.includes("precast") ||
    jobTypeNameLower.includes("infrastructure") ||
    jobTypeNameLower.includes("civil") ||
    jobTypeNameLower.includes("industrial") ||
    jobTypeNameLower.includes("hospital") ||
    jobTypeNameLower.includes("government");

  if (isSmallResidential || estimatedValue < 200000) {
    searchRadiusKm = 25;
    projectScale = "Small Residential (1-5 days typical)";
  } else if (isLargeProject || estimatedValue > 2000000) {
    searchRadiusKm = 80;
    projectScale = "Large / Long Duration";
  } else {
    searchRadiusKm = 45;
    projectScale = "Medium Commercial / Multi-Week";
  }

  if (estimatedValue > 5000000) {
    searchRadiusKm = 100;
    projectScale = "Major Project (state-wide search)";
  }

  return { searchRadiusKm, projectScale };
}

router.get("/api/tenders/:id/search-radius", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const [tender] = await db
      .select({ id: tenders.id, jobId: tenders.jobId })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));

    if (!tender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    const [job] = await db
      .select({
        id: jobs.id, name: jobs.name, address: jobs.address,
        city: jobs.city, state: jobs.state, estimatedValue: jobs.estimatedValue,
        jobTypeId: jobs.jobTypeId,
      })
      .from(jobs)
      .where(and(eq(jobs.id, tender.jobId), eq(jobs.companyId, companyId)));

    if (!job) {
      return res.status(404).json({ message: "Job not found for this tender", code: "NOT_FOUND" });
    }

    let jobTypeName = "Construction";
    if (job.jobTypeId) {
      const [jt] = await db.select({ name: jobTypes.name }).from(jobTypes).where(eq(jobTypes.id, job.jobTypeId));
      if (jt) jobTypeName = jt.name;
    }

    const estimatedValueNum = job.estimatedValue ? parseFloat(job.estimatedValue) : 0;
    const location = [job.address, job.city, job.state].filter(Boolean).join(", ") || "Australia";
    const projectValue = job.estimatedValue ? `$${parseFloat(job.estimatedValue).toLocaleString()}` : "Not specified";

    const { searchRadiusKm, projectScale } = calculateSearchRadius(jobTypeName, estimatedValueNum);

    res.json({
      searchRadiusKm,
      projectScale,
      location,
      projectType: jobTypeName,
      projectValue,
    });
  } catch (error: unknown) {
    logger.error("Error calculating search radius:", error);
    res.status(500).json({ message: "Failed to calculate search radius", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/find-suppliers", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const schema = z.object({
      costCodeIds: z.array(z.string()).min(1, "At least one cost code is required"),
      searchRadiusKm: z.number().min(5).max(500).optional(),
    });
    const data = schema.parse(req.body);

    const [tender] = await db
      .select({
        id: tenders.id,
        title: tenders.title,
        jobId: tenders.jobId,
      })
      .from(tenders)
      .where(and(eq(tenders.id, tenderId), eq(tenders.companyId, companyId)));

    const [job] = await db
      .select({
        id: jobs.id,
        name: jobs.name,
        address: jobs.address,
        city: jobs.city,
        state: jobs.state,
        estimatedValue: jobs.estimatedValue,
        jobTypeId: jobs.jobTypeId,
      })
      .from(jobs)
      .where(and(eq(jobs.id, tender.jobId), eq(jobs.companyId, companyId)));

    let jobTypeName = "Construction";
    if (job?.jobTypeId) {
      const [jt] = await db
        .select({ name: jobTypes.name })
        .from(jobTypes)
        .where(eq(jobTypes.id, job.jobTypeId));
      if (jt) jobTypeName = jt.name;
    }

    const selectedCodes = await db
      .select({ id: costCodes.id, code: costCodes.code, name: costCodes.name })
      .from(costCodes)
      .where(and(inArray(costCodes.id, data.costCodeIds), eq(costCodes.companyId, companyId)));

    const costCodeEntries = selectedCodes.map(c => ({ id: c.id, code: c.code, name: c.name, label: `${c.code} - ${c.name}` }));
    const costCodeNames = costCodeEntries.map(c => c.label).join(", ");
    const costCodeLookup = new Map(costCodeEntries.map(c => [c.label.toLowerCase(), c.id]));
    costCodeEntries.forEach(c => {
      costCodeLookup.set(c.name.toLowerCase(), c.id);
      costCodeLookup.set(c.code.toLowerCase(), c.id);
    });

    const location = [job?.address, job?.city, job?.state].filter(Boolean).join(", ") || "Australia";
    const projectValue = job?.estimatedValue ? `$${parseFloat(job.estimatedValue).toLocaleString()}` : "Not specified";
    const estimatedValueNum = job?.estimatedValue ? parseFloat(job.estimatedValue) : 0;

    const calculated = calculateSearchRadius(jobTypeName, estimatedValueNum);
    const searchRadiusKm = data.searchRadiusKm || calculated.searchRadiusKm;
    const projectScale = calculated.projectScale;

    const tradeCategoryList = costCodeEntries.map(c => `"${c.label}"`).join(", ");

    const openai = new OpenAI();

    const prompt = `You are a construction industry procurement assistant for Australia. Find real suppliers/subcontractors for the following tender requirements.

Project Details:
- Project Type: ${jobTypeName}
- Project Scale: ${projectScale}
- Project Name: ${job?.name || tender.title}
- Location: ${location}
- Estimated Value: ${projectValue}
- Trade Categories Needed: ${costCodeNames}
- Search Radius: ${searchRadiusKm}km from the project location

IMPORTANT SEARCH RADIUS RULES (Australian construction industry standards):
- This is classified as a "${projectScale}" project.
- You MUST find suppliers located within ${searchRadiusKm}km of ${location}.
- For small residential jobs (1-5 days), trades prefer to stay within 25km / 30 minutes drive and will avoid CBD congestion unless premium rates.
- For medium commercial multi-week work (consistent work), trades will travel 40-50km, especially if parking and site access are good.
- For large projects (high-rise, precast, long duration), trades will travel 60-90km or even temporarily relocate.
- Prioritise suppliers closest to the job site first, then expand outward within the ${searchRadiusKm}km radius.

Find as many real Australian suppliers/subcontractors as possible for these trade categories within ${searchRadiusKm}km of ${location}. For each supplier, provide realistic business details.
Aim for 3-5 suppliers PER trade category, for a total of ${Math.min(Math.max(costCodeEntries.length * 4, 15), 50)} suppliers overall. More results are better - the user wants comprehensive coverage.

CRITICAL: Each supplier MUST be assigned to exactly one of these trade categories: ${tradeCategoryList}
You MUST provide at least 3 suppliers per trade category where possible. The "tradeCategory" field MUST exactly match one of the values listed above.

IMPORTANT: Return ONLY a valid JSON array. No markdown, no explanation. Each object must have these exact fields:
[
  {
    "companyName": "string - company/business name",
    "contactName": "string - key contact person name",
    "email": "string - business email address",
    "phone": "string - Australian phone number",
    "specialty": "string - brief description of their specialty/trade",
    "location": "string - city/suburb and state",
    "estimatedDistanceKm": "number - estimated distance in km from job site",
    "tradeCategory": "string - MUST be exactly one of: ${tradeCategoryList}"
  }
]

Return as many suppliers as you can find (aim for ${Math.min(Math.max(costCodeEntries.length * 4, 15), 50)} total, with 3-5 per trade category). Make sure they are realistic for the ${location} area (within ${searchRadiusKm}km) and relevant to the trade categories: ${costCodeNames}. Group and sort results by trade category, then by proximity (closest first) within each category.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a construction procurement assistant. Always respond with valid JSON arrays only. No markdown formatting." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "[]";

    let foundSuppliers: Array<{
      companyName: string;
      contactName: string;
      email: string;
      phone: string;
      specialty: string;
      location: string;
      estimatedDistanceKm?: number;
      tradeCategory?: string;
      costCodeId?: string;
    }> = [];

    try {
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      foundSuppliers = JSON.parse(cleaned);
      if (!Array.isArray(foundSuppliers)) foundSuppliers = [];
    } catch {
      logger.warn("Failed to parse AI supplier response:", responseText.substring(0, 200));
      foundSuppliers = [];
    }

    for (const supplier of foundSuppliers) {
      if (supplier.tradeCategory) {
        const tcLower = supplier.tradeCategory.toLowerCase().trim();
        let matchedId = costCodeLookup.get(tcLower);
        if (!matchedId) {
          for (const [key, id] of costCodeLookup.entries()) {
            if (tcLower.includes(key) || key.includes(tcLower)) {
              matchedId = id;
              break;
            }
          }
        }
        if (matchedId) {
          supplier.costCodeId = matchedId;
          const matchedEntry = costCodeEntries.find(c => c.id === matchedId);
          if (matchedEntry) supplier.tradeCategory = matchedEntry.label;
        }
      }
      if (!supplier.costCodeId && costCodeEntries.length === 1) {
        supplier.costCodeId = costCodeEntries[0].id;
        supplier.tradeCategory = costCodeEntries[0].label;
      }
    }

    res.json({
      suppliers: foundSuppliers,
      costCodeMapping: costCodeEntries.map(c => ({ id: c.id, label: c.label })),
      context: {
        costCodes: costCodeNames,
        location,
        projectType: jobTypeName,
        projectValue,
        searchRadiusKm,
        projectScale,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error finding suppliers via AI:", error);
    res.status(500).json({ message: "Failed to find suppliers", code: "INTERNAL_ERROR" });
  }
});

router.post("/api/tenders/:id/add-found-suppliers", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;
    const tenderId = req.params.id;
    if (!isValidId(tenderId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    const supplierSchema = z.object({
      companyName: z.string().min(1),
      contactName: z.string().optional().default(""),
      email: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      specialty: z.string().optional().default(""),
      location: z.string().optional().default(""),
      costCodeId: z.string().nullable().optional(),
      tradeCategory: z.string().optional(),
      estimatedDistanceKm: z.coerce.number().optional(),
    });

    const schema = z.object({
      suppliers: z.array(supplierSchema).min(1, "At least one supplier is required"),
      defaultCostCodeId: z.string().nullable().optional(),
    });

    const data = schema.parse(req.body);

    const addedSuppliers: Array<{ supplierId: string; name: string; memberId: string }> = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    for (const s of data.suppliers) {
      try {
        const existing = await db
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(and(
            eq(suppliers.companyId, companyId),
            eq(suppliers.name, s.companyName),
          ))
          .limit(1);

        let supplierId: string;

        if (existing.length > 0) {
          supplierId = existing[0].id;
        } else {
          const [newSupplier] = await db
            .insert(suppliers)
            .values({
              companyId,
              name: s.companyName,
              keyContact: s.contactName || null,
              email: s.email || null,
              phone: s.phone || null,
              notes: s.specialty ? `Specialty: ${s.specialty}. Location: ${s.location}` : null,
              defaultCostCodeId: s.costCodeId || data.defaultCostCodeId || null,
              isActive: true,
              availableForTender: true,
            })
            .returning({ id: suppliers.id });
          supplierId = newSupplier.id;
        }

        const existingMember = await db
          .select({ id: tenderMembers.id })
          .from(tenderMembers)
          .where(and(
            eq(tenderMembers.tenderId, tenderId),
            eq(tenderMembers.supplierId, supplierId),
            eq(tenderMembers.companyId, companyId),
          ))
          .limit(1);

        if (existingMember.length > 0) {
          skipped.push({ name: s.companyName, reason: "Already a member of this tender" });
          continue;
        }

        const [member] = await db
          .insert(tenderMembers)
          .values({
            companyId,
            tenderId,
            supplierId,
            status: "PENDING",
          })
          .returning({ id: tenderMembers.id });

        addedSuppliers.push({ supplierId, name: s.companyName, memberId: member.id });
      } catch (innerError: unknown) {
        logger.warn({ err: innerError, supplier: s.companyName }, "Failed to add individual supplier");
        skipped.push({ name: s.companyName, reason: "Failed to create" });
      }
    }

    res.json({
      added: addedSuppliers.length,
      skipped: skipped.length,
      addedSuppliers,
      skippedSuppliers: skipped,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error adding found suppliers:", error);
    res.status(500).json({ message: "Failed to add suppliers", code: "INTERNAL_ERROR" });
  }
});

// ===== TENDER NOTES ROUTES =====

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
      .orderBy(desc(tenderNotes.createdAt));

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

// ===== TENDER FILES ROUTES =====

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
      .orderBy(desc(tenderFiles.createdAt));

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

// ===== SEND TENDER FILES BY EMAIL =====

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
      ));

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

// ===== SEND INVITE TO SINGLE MEMBER =====

router.post("/api/tenders/:id/members/:memberId/send-invite", requireAuth, requirePermission("tenders", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id: tenderId, memberId } = req.params;
    if (!isValidId(tenderId) || !isValidId(memberId)) return res.status(400).json({ message: "Invalid ID format", code: "VALIDATION_ERROR" });

    if (!(await verifyTenderOwnership(companyId, tenderId))) {
      return res.status(403).json({ message: "Tender not found or access denied", code: "FORBIDDEN" });
    }

    if (!emailService.isConfigured()) {
      return res.status(503).json({ error: "Email service is not configured" });
    }

    const schema = z.object({
      subject: z.string().min(1, "Subject is required"),
      message: z.string().min(1, "Message is required"),
    });
    const data = schema.parse(req.body);

    const [row] = await db
      .select({
        member: tenderMembers,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          email: suppliers.email,
        },
      })
      .from(tenderMembers)
      .leftJoin(suppliers, eq(tenderMembers.supplierId, suppliers.id))
      .where(and(eq(tenderMembers.id, memberId), eq(tenderMembers.tenderId, tenderId), eq(tenderMembers.companyId, companyId)));

    if (!row) return res.status(404).json({ message: "Member not found", code: "NOT_FOUND" });

    const email = row.supplier?.email;
    if (!email) return res.status(400).json({ message: "Supplier has no email address", code: "VALIDATION_ERROR" });

    const [tender] = await db
      .select({ tenderNumber: tenders.tenderNumber, title: tenders.title })
      .from(tenders)
      .where(eq(tenders.id, tenderId));

    const packages = await db
      .select({
        pkg: tenderPackages,
        bundle: {
          id: documentBundles.id,
          bundleName: documentBundles.bundleName,
          qrCodeId: documentBundles.qrCodeId,
          description: documentBundles.description,
        },
      })
      .from(tenderPackages)
      .leftJoin(documentBundles, eq(tenderPackages.bundleId, documentBundles.id))
      .where(and(eq(tenderPackages.tenderId, tenderId), isNotNull(tenderPackages.bundleId)));

    let bundleSection = "";
    const bundlesWithQr = packages.filter(p => p.bundle?.qrCodeId);
    if (bundlesWithQr.length > 0) {
      const bundleItems = (await Promise.all(bundlesWithQr.map(async (p) => {
        const bundleUrl = `${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : ""}/bundles/${p.bundle!.qrCodeId}`;
        let qrImg = "";
        try {
          const qrDataUrl = await QRCode.toDataURL(bundleUrl, { width: 150, margin: 1 });
          qrImg = `<div style="text-align: center; margin: 12px 0;"><img src="${qrDataUrl}" alt="QR Code" style="width: 150px; height: 150px;" /></div>`;
        } catch { /* skip QR */ }
        return `<div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <h3 style="margin: 0 0 4px 0; font-size: 16px;">${p.bundle!.bundleName}</h3>
          ${qrImg}
          <div style="text-align: center; margin-top: 12px;">
            <a href="${bundleUrl}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px;">View Tender Documents</a>
          </div>
        </div>`;
      }))).join("");

      bundleSection = `<div style="margin-top: 24px; border-top: 2px solid #2563eb; padding-top: 20px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px;">Tender Documents</h2>
        ${bundleItems}
      </div>`;
    }

    const htmlBody = await buildBrandedEmail({
      title: "Tender Invitation",
      recipientName: row.supplier?.name || undefined,
      body: `<div style="margin-bottom: 24px;">${data.message.replace(/\n/g, "<br>")}</div>${bundleSection}`,
      companyId,
    });

    await emailService.sendEmailWithAttachment({ to: email, subject: data.subject, body: htmlBody });

    await db.update(tenderMembers)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(tenderMembers.id, memberId));

    res.json({ success: true, supplierName: row.supplier?.name });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", code: "VALIDATION_ERROR", errors: error.errors });
    }
    logger.error("Error sending single tender invite:", error);
    res.status(500).json({ message: "Failed to send invitation", code: "INTERNAL_ERROR" });
  }
});

export const tenderRouter = router;
