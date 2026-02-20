import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenders, tenderPackages, tenderSubmissions, tenderMembers, suppliers, users, jobs, documents, documentBundles, documentBundleItems } from "@shared/schema";
import { eq, and, desc, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import {
  isValidId,
  VALID_TRANSITIONS,
  VALID_STATUSES,
  tenderSchema,
  getNextTenderNumber,
  paginationSchema,
} from "./shared";

const router = Router();

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
      .where(and(eq(tenderMembers.tenderId, req.params.id), eq(tenderMembers.companyId, companyId)))
      .limit(1000);

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

    const [currentTender] = await db.select({ id: tenders.id, status: tenders.status, openDate: tenders.openDate, closedDate: tenders.closedDate }).from(tenders).where(and(eq(tenders.id, req.params.id), eq(tenders.companyId, companyId)));
    if (!currentTender) {
      return res.status(404).json({ message: "Tender not found", code: "NOT_FOUND" });
    }

    if (data.status !== undefined) {
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
          ))
          .limit(1000);

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

export default router;
