import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import logger from "../lib/logger";
import { db } from "../db";
import { boqGroups, boqItems, costCodes, childCostCodes, budgetLines, tenderLineItems, jobs } from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireUUID } from "../lib/api-utils";
import ExcelJS from "exceljs";

const router = Router();

function computeLineTotal(quantity: string, unitPrice: string): string {
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  return (qty * price).toFixed(2);
}

function computeLineTotalWithMarkup(lineTotal: string, markupPercent: string): string {
  const total = parseFloat(lineTotal) || 0;
  const markup = parseFloat(markupPercent) || 0;
  return (total * (1 + markup / 100)).toFixed(2);
}

const boqGroupSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  budgetLineId: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const boqItemSchema = z.object({
  costCodeId: z.string().min(1, "Cost code is required"),
  childCostCodeId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  budgetLineId: z.string().nullable().optional(),
  tenderLineItemId: z.string().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().regex(/^-?\d*\.?\d*$/, "Must be a valid number").nullable().optional(),
  unit: z.enum(["EA", "SQM", "M3", "LM", "M2", "M", "HR", "DAY", "TONNE", "KG", "LOT"]).optional(),
  unitPrice: z.string().regex(/^-?\d*\.?\d*$/, "Must be a valid number").nullable().optional(),
  markupPercent: z.string().regex(/^-?\d*\.?\d*$/, "Must be a valid number").nullable().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/api/jobs/:jobId/boq/groups", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
    const { costCodeId } = req.query;

    let conditions = [eq(boqGroups.jobId, jobId), eq(boqGroups.companyId, companyId)];

    if (costCodeId && typeof costCodeId === "string") {
      conditions.push(eq(boqGroups.costCodeId, costCodeId));
    }

    const results = await db
      .select({
        group: boqGroups,
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
      .from(boqGroups)
      .innerJoin(costCodes, eq(boqGroups.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqGroups.childCostCodeId, childCostCodes.id))
      .where(and(...conditions))
      .orderBy(asc(boqGroups.sortOrder), asc(boqGroups.name))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.group,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching BOQ groups");
    res.status(500).json({ message: "Failed to fetch BOQ groups" });
  }
});

router.post("/api/jobs/:jobId/boq/groups", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
    const data = boqGroupSchema.parse(req.body);

    const [result] = await db
      .insert(boqGroups)
      .values({
        companyId,
        jobId,
        costCodeId: data.costCodeId,
        childCostCodeId: data.childCostCodeId || null,
        budgetLineId: data.budgetLineId || null,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating BOQ group");
    res.status(500).json({ message: "Failed to create BOQ group" });
  }
});

router.patch("/api/jobs/:jobId/boq/groups/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    const data = boqGroupSchema.partial().parse(req.body);

    const [result] = await db
      .update(boqGroups)
      .set({
        ...data,
        budgetLineId: data.budgetLineId !== undefined ? (data.budgetLineId || null) : undefined,
        description: data.description !== undefined ? (data.description || null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)))
      .returning();

    if (!result) {
      return res.status(404).json({ message: "BOQ group not found" });
    }
    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating BOQ group");
    res.status(500).json({ message: "Failed to update BOQ group" });
  }
});

router.delete("/api/jobs/:jobId/boq/groups/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(boqGroups)
      .where(and(eq(boqGroups.id, id), eq(boqGroups.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "BOQ group not found" });
    }
    res.json({ message: "BOQ group deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting BOQ group");
    res.status(500).json({ message: "Failed to delete BOQ group" });
  }
});

router.get("/api/jobs/:jobId/boq/items", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
    const { groupId, costCodeId } = req.query;

    let conditions = [eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)];

    if (groupId && typeof groupId === "string") {
      conditions.push(eq(boqItems.groupId, groupId));
    }
    if (costCodeId && typeof costCodeId === "string") {
      conditions.push(eq(boqItems.costCodeId, costCodeId));
    }

    const results = await db
      .select({
        item: boqItems,
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
      .from(boqItems)
      .innerJoin(costCodes, eq(boqItems.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqItems.childCostCodeId, childCostCodes.id))
      .where(and(...conditions))
      .orderBy(asc(boqItems.sortOrder), asc(boqItems.description))
      .limit(1000);

    const mapped = results.map((row) => ({
      ...row.item,
      costCode: row.costCode,
      childCostCode: row.childCostCode?.id ? row.childCostCode : null,
    }));

    res.json(mapped);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching BOQ items");
    res.status(500).json({ message: "Failed to fetch BOQ items" });
  }
});

router.post("/api/jobs/:jobId/boq/items", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;
    const data = boqItemSchema.parse(req.body);

    const qty = data.quantity || "0";
    const price = data.unitPrice || "0";
    const markup = data.markupPercent || "0";
    const lt = computeLineTotal(qty, price);
    const ltm = computeLineTotalWithMarkup(lt, markup);

    const [result] = await db
      .insert(boqItems)
      .values({
        companyId,
        jobId,
        costCodeId: data.costCodeId,
        childCostCodeId: data.childCostCodeId || null,
        groupId: data.groupId || null,
        budgetLineId: data.budgetLineId || null,
        tenderLineItemId: data.tenderLineItemId || null,
        description: data.description,
        quantity: qty,
        unit: data.unit ?? "EA",
        unitPrice: price,
        markupPercent: markup,
        lineTotal: lt,
        lineTotalWithMarkup: ltm,
        notes: data.notes || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating BOQ item");
    res.status(500).json({ message: "Failed to create BOQ item" });
  }
});

router.patch("/api/jobs/:jobId/boq/items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = boqItemSchema.partial().parse(req.body);
    const id = req.params.id as string;

    const [existing] = await db
      .select()
      .from(boqItems)
      .where(and(eq(boqItems.id, id), eq(boqItems.companyId, companyId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "BOQ item not found" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.costCodeId !== undefined) updateData.costCodeId = data.costCodeId;
    if (data.childCostCodeId !== undefined) updateData.childCostCodeId = data.childCostCodeId || null;
    if (data.groupId !== undefined) updateData.groupId = data.groupId || null;
    if (data.budgetLineId !== undefined) updateData.budgetLineId = data.budgetLineId || null;
    if (data.tenderLineItemId !== undefined) updateData.tenderLineItemId = data.tenderLineItemId || null;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const finalQty = data.quantity !== undefined ? (data.quantity || "0") : existing.quantity;
    const finalPrice = data.unitPrice !== undefined ? (data.unitPrice || "0") : existing.unitPrice;
    const finalMarkup = data.markupPercent !== undefined ? (data.markupPercent || "0") : (existing.markupPercent || "0");

    if (data.quantity !== undefined) updateData.quantity = finalQty;
    if (data.unitPrice !== undefined) updateData.unitPrice = finalPrice;
    if (data.markupPercent !== undefined) updateData.markupPercent = finalMarkup;

    const lt = computeLineTotal(finalQty as string, finalPrice as string);
    const ltm = computeLineTotalWithMarkup(lt, finalMarkup as string);
    updateData.lineTotal = lt;
    updateData.lineTotalWithMarkup = ltm;

    const [result] = await db
      .update(boqItems)
      .set(updateData)
      .where(and(eq(boqItems.id, id), eq(boqItems.companyId, companyId)))
      .returning();

    res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error updating BOQ item");
    res.status(500).json({ message: "Failed to update BOQ item" });
  }
});

router.delete("/api/jobs/:jobId/boq/items/:id", requireAuth, requirePermission("budgets", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(boqItems)
      .where(and(eq(boqItems.id, id), eq(boqItems.companyId, companyId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: "BOQ item not found" });
    }
    res.json({ message: "BOQ item deleted", id: deleted.id });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting BOQ item");
    res.status(500).json({ message: "Failed to delete BOQ item" });
  }
});

router.get("/api/jobs/:jobId/boq/summary", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

    const [totals] = await db
      .select({
        totalItems: sql<number>`COUNT(*)::int`,
        totalValue: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotal} AS DECIMAL(14,2))), 0)`,
        totalWithMarkup: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotalWithMarkup} AS DECIMAL(14,2))), 0)`,
      })
      .from(boqItems)
      .where(and(eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)));

    const breakdown = await db
      .select({
        costCodeId: costCodes.id,
        costCode: costCodes.code,
        costCodeName: costCodes.name,
        itemCount: sql<number>`COUNT(*)::int`,
        subtotal: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotal} AS DECIMAL(14,2))), 0)`,
        subtotalWithMarkup: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotalWithMarkup} AS DECIMAL(14,2))), 0)`,
      })
      .from(boqItems)
      .innerJoin(costCodes, eq(boqItems.costCodeId, costCodes.id))
      .where(and(eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)))
      .groupBy(costCodes.id, costCodes.code, costCodes.name)
      .orderBy(asc(costCodes.code))
      .limit(1000);

    const groupSummaries = await db
      .select({
        groupId: boqGroups.id,
        groupName: boqGroups.name,
        itemCount: sql<number>`COUNT(${boqItems.id})::int`,
        subtotal: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotal} AS DECIMAL(14,2))), 0)`,
        subtotalWithMarkup: sql<string>`COALESCE(SUM(CAST(${boqItems.lineTotalWithMarkup} AS DECIMAL(14,2))), 0)`,
      })
      .from(boqGroups)
      .leftJoin(boqItems, and(eq(boqItems.groupId, boqGroups.id), eq(boqItems.companyId, companyId)))
      .where(and(eq(boqGroups.jobId, jobId), eq(boqGroups.companyId, companyId)))
      .groupBy(boqGroups.id, boqGroups.name)
      .orderBy(asc(boqGroups.sortOrder), asc(boqGroups.name))
      .limit(1000);

    res.json({
      totalItems: totals?.totalItems || 0,
      totalValue: totals?.totalValue || "0",
      totalWithMarkup: totals?.totalWithMarkup || "0",
      breakdown,
      groupSummaries,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching BOQ summary");
    res.status(500).json({ message: "Failed to fetch BOQ summary" });
  }
});

router.get("/api/jobs/:jobId/boq/export", requireAuth, requirePermission("budgets", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = requireUUID(req, res, "jobId");
    if (!jobId) return;

    const [job] = await db
      .select({ jobNumber: jobs.jobNumber, name: jobs.name })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
      .limit(1);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const allGroups = await db
      .select({
        group: boqGroups,
        costCode: { id: costCodes.id, code: costCodes.code, name: costCodes.name },
        childCostCode: { id: childCostCodes.id, code: childCostCodes.code, name: childCostCodes.name },
      })
      .from(boqGroups)
      .innerJoin(costCodes, eq(boqGroups.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqGroups.childCostCodeId, childCostCodes.id))
      .where(and(eq(boqGroups.jobId, jobId), eq(boqGroups.companyId, companyId)))
      .orderBy(asc(boqGroups.sortOrder), asc(boqGroups.name))
      .limit(1000);

    const allItemsResult = await db
      .select({
        item: boqItems,
        costCode: { id: costCodes.id, code: costCodes.code, name: costCodes.name },
        childCostCode: { id: childCostCodes.id, code: childCostCodes.code, name: childCostCodes.name },
      })
      .from(boqItems)
      .innerJoin(costCodes, eq(boqItems.costCodeId, costCodes.id))
      .leftJoin(childCostCodes, eq(boqItems.childCostCodeId, childCostCodes.id))
      .where(and(eq(boqItems.jobId, jobId), eq(boqItems.companyId, companyId)))
      .orderBy(asc(boqItems.sortOrder), asc(boqItems.description))
      .limit(5000);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BuildPlus AI";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Bill of Quantities");

    ws.columns = [
      { header: "Group", key: "group", width: 20 },
      { header: "Cost Code", key: "costCode", width: 15 },
      { header: "Child Code", key: "childCode", width: 15 },
      { header: "Description", key: "description", width: 40 },
      { header: "Qty", key: "quantity", width: 12 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Unit Price", key: "unitPrice", width: 14 },
      { header: "Markup %", key: "markupPercent", width: 12 },
      { header: "Line Total", key: "lineTotal", width: 16 },
      { header: "Total (incl. Markup)", key: "lineTotalWithMarkup", width: 18 },
      { header: "Notes", key: "notes", width: 30 },
    ];

    const titleRow = ws.insertRow(1, [`BILL OF QUANTITIES - ${job.jobNumber} - ${job.name}`]);
    ws.mergeCells("A1:K1");
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { horizontal: "center" };

    const dateRow = ws.insertRow(2, [`Generated: ${new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })}`]);
    ws.mergeCells("A2:K2");
    dateRow.font = { italic: true, size: 10, color: { argb: "FF666666" } };
    dateRow.alignment = { horizontal: "center" };

    ws.insertRow(3, []);

    const headerRow = ws.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 24;

    const groupMap = new Map<string, { group: typeof allGroups[0]; items: typeof allItemsResult }>();
    for (const g of allGroups) {
      groupMap.set(g.group.id, { group: g, items: [] });
    }

    const ungroupedItems: typeof allItemsResult = [];

    for (const itemRow of allItemsResult) {
      if (itemRow.item.groupId && groupMap.has(itemRow.item.groupId)) {
        groupMap.get(itemRow.item.groupId)!.items.push(itemRow);
      } else {
        ungroupedItems.push(itemRow);
      }
    }

    let currentRow = 5;
    let grandTotal = 0;
    let grandTotalMarkup = 0;

    for (const [, { group, items }] of groupMap) {
      const groupRow = ws.getRow(currentRow);
      groupRow.getCell(1).value = group.group.name;
      groupRow.getCell(2).value = `${group.costCode.code} - ${group.costCode.name}`;
      if (group.childCostCode?.id) {
        groupRow.getCell(3).value = `${group.childCostCode.code} - ${group.childCostCode.name}`;
      }
      groupRow.font = { bold: true, size: 11 };
      groupRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      currentRow++;

      let groupSubtotal = 0;
      let groupSubtotalMarkup = 0;

      for (const itemRow of items) {
        const item = itemRow.item;
        const r = ws.getRow(currentRow);
        r.getCell(1).value = "";
        r.getCell(2).value = itemRow.costCode.code;
        r.getCell(3).value = itemRow.childCostCode?.id ? itemRow.childCostCode.code : "";
        r.getCell(4).value = item.description;
        r.getCell(5).value = parseFloat(item.quantity || "0");
        r.getCell(5).numFmt = "#,##0.0000";
        r.getCell(6).value = item.unit;
        r.getCell(7).value = parseFloat(item.unitPrice || "0");
        r.getCell(7).numFmt = "$#,##0.00";
        r.getCell(8).value = parseFloat(item.markupPercent || "0");
        r.getCell(8).numFmt = "0.00%";
        r.getCell(9).value = parseFloat(item.lineTotal || "0");
        r.getCell(9).numFmt = "$#,##0.00";
        r.getCell(10).value = parseFloat(item.lineTotalWithMarkup || "0");
        r.getCell(10).numFmt = "$#,##0.00";
        r.getCell(11).value = item.notes || "";
        groupSubtotal += parseFloat(item.lineTotal || "0");
        groupSubtotalMarkup += parseFloat(item.lineTotalWithMarkup || "0");
        currentRow++;
      }

      const subtotalRow = ws.getRow(currentRow);
      subtotalRow.getCell(4).value = `Subtotal: ${group.group.name}`;
      subtotalRow.getCell(4).font = { bold: true, italic: true };
      subtotalRow.getCell(9).value = groupSubtotal;
      subtotalRow.getCell(9).numFmt = "$#,##0.00";
      subtotalRow.getCell(9).font = { bold: true };
      subtotalRow.getCell(10).value = groupSubtotalMarkup;
      subtotalRow.getCell(10).numFmt = "$#,##0.00";
      subtotalRow.getCell(10).font = { bold: true };
      subtotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
      grandTotal += groupSubtotal;
      grandTotalMarkup += groupSubtotalMarkup;
      currentRow++;
      currentRow++;
    }

    if (ungroupedItems.length > 0) {
      if (allGroups.length > 0) {
        const ungroupedHeader = ws.getRow(currentRow);
        ungroupedHeader.getCell(1).value = "Ungrouped Items";
        ungroupedHeader.font = { bold: true, size: 11 };
        ungroupedHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        currentRow++;
      }

      for (const itemRow of ungroupedItems) {
        const item = itemRow.item;
        const r = ws.getRow(currentRow);
        r.getCell(1).value = "";
        r.getCell(2).value = itemRow.costCode.code;
        r.getCell(3).value = itemRow.childCostCode?.id ? itemRow.childCostCode.code : "";
        r.getCell(4).value = item.description;
        r.getCell(5).value = parseFloat(item.quantity || "0");
        r.getCell(5).numFmt = "#,##0.0000";
        r.getCell(6).value = item.unit;
        r.getCell(7).value = parseFloat(item.unitPrice || "0");
        r.getCell(7).numFmt = "$#,##0.00";
        r.getCell(8).value = parseFloat(item.markupPercent || "0");
        r.getCell(8).numFmt = "0.00%";
        r.getCell(9).value = parseFloat(item.lineTotal || "0");
        r.getCell(9).numFmt = "$#,##0.00";
        r.getCell(10).value = parseFloat(item.lineTotalWithMarkup || "0");
        r.getCell(10).numFmt = "$#,##0.00";
        r.getCell(11).value = item.notes || "";
        grandTotal += parseFloat(item.lineTotal || "0");
        grandTotalMarkup += parseFloat(item.lineTotalWithMarkup || "0");
        currentRow++;
      }
    }

    currentRow++;
    const totalRow = ws.getRow(currentRow);
    totalRow.getCell(4).value = "GRAND TOTAL";
    totalRow.getCell(4).font = { bold: true, size: 12 };
    totalRow.getCell(9).value = grandTotal;
    totalRow.getCell(9).numFmt = "$#,##0.00";
    totalRow.getCell(9).font = { bold: true, size: 12 };
    totalRow.getCell(10).value = grandTotalMarkup;
    totalRow.getCell(10).numFmt = "$#,##0.00";
    totalRow.getCell(10).font = { bold: true, size: 12 };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    totalRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };

    const markupDiff = grandTotalMarkup - grandTotal;
    if (markupDiff > 0) {
      currentRow++;
      const markupRow = ws.getRow(currentRow);
      markupRow.getCell(4).value = "TOTAL MARKUP VALUE";
      markupRow.getCell(4).font = { bold: true, italic: true };
      markupRow.getCell(10).value = markupDiff;
      markupRow.getCell(10).numFmt = "$#,##0.00";
      markupRow.getCell(10).font = { bold: true, italic: true, color: { argb: "FF16A34A" } };
    }

    const filename = `BOQ_${job.jobNumber}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error exporting BOQ");
    res.status(500).json({ message: "Failed to export BOQ" });
  }
});

export const boqRouter = router;
