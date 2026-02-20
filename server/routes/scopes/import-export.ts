import { Router, Request, Response } from "express";
import { z } from "zod";
import ExcelJS from "exceljs";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopes, scopeItems, scopeTrades, jobTypes } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import OpenAI from "openai";
import { isValidId, scopeUpload, verifyScopeOwnership, verifyTradeOwnership } from "./shared";

const router = Router();
const openai = new OpenAI();

router.post("/api/scopes/import-parse", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), scopeUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const items: { category: string; description: string; details: string }[] = [];

    const workbook = new ExcelJS.Workbook();
    if (req.file.mimetype === "text/csv") {
      await workbook.csv.read(require("stream").Readable.from(req.file.buffer));
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return res.status(400).json({ message: "File is empty or has no data rows" });
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      headers[colNum - 1] = String(cell.value || "").toLowerCase().trim();
    });

    const catIdx = headers.findIndex(h => h.includes("category") || h.includes("cat") || h.includes("section") || h.includes("group"));
    const descIdx = headers.findIndex(h => h.includes("description") || h.includes("desc") || h.includes("item") || h.includes("scope") || h.includes("text") || h.includes("title"));
    const detailIdx = headers.findIndex(h => h.includes("detail") || h.includes("note") || h.includes("spec") || h.includes("comment") || h.includes("info"));

    if (descIdx === -1) {
      const firstCol = headers[0] || "";
      if (!firstCol) {
        return res.status(400).json({ message: "Could not find a description column. Please ensure your file has a column header containing 'description', 'item', 'scope', or 'text'." });
      }
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const cellVal = String(row.getCell(1).value || "").trim();
        if (!cellVal) continue;
        items.push({ category: "General", description: cellVal, details: "" });
      }
    } else {
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const desc = String(row.getCell(descIdx + 1).value || "").trim();
        if (!desc) continue;
        items.push({
          category: catIdx >= 0 ? String(row.getCell(catIdx + 1).value || "General").trim() : "General",
          description: desc,
          details: detailIdx >= 0 ? String(row.getCell(detailIdx + 1).value || "").trim() : "",
        });
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ message: "No scope items found in the file. Ensure the file has rows with content." });
    }

    res.json({ items, count: items.length, fileName: req.file.originalname });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error parsing scope import file");
    res.status(500).json({ message: "Failed to parse the uploaded file" });
  }
});

router.post("/api/scopes/import-create", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;

    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      tradeId: z.string().min(1, "Trade is required"),
      jobTypeId: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      aiFormat: z.boolean().default(false),
      items: z.array(z.object({
        category: z.string(),
        description: z.string().min(1),
        details: z.string().optional().default(""),
      })),
    });
    const data = schema.parse(req.body);

    if (!(await verifyTradeOwnership(companyId, data.tradeId))) {
      return res.status(400).json({ message: "Invalid trade" });
    }
    if (data.jobTypeId) {
      const [jt] = await db.select({ id: jobTypes.id }).from(jobTypes).where(and(eq(jobTypes.id, data.jobTypeId), eq(jobTypes.companyId, companyId))).limit(1);
      if (!jt) return res.status(400).json({ message: "Invalid job type" });
    }

    let finalItems = data.items;

    if (data.aiFormat) {
      const [trade] = await db.select({ name: scopeTrades.name }).from(scopeTrades).where(eq(scopeTrades.id, data.tradeId)).limit(1);

      const rawItemsList = data.items.map((item, idx) =>
        `${idx + 1}. [${item.category}] ${item.description}${item.details ? ` - ${item.details}` : ""}`
      ).join("\n");

      const prompt = `You are an expert construction scope of works consultant in Australia. A user has imported the following scope items from a spreadsheet. Your job is to:

1. Clean up, reword, and standardize each item to be professional, clear, and industry-standard
2. Ensure proper categorization (fix incorrect categories, merge duplicates, split items that cover multiple concerns)
3. Add missing technical details, Australian Standards references, and specifications where appropriate
4. Ensure items are comprehensive - add any obvious missing items for the trade
5. Remove any items that are clearly not scope items (e.g., headers, totals, empty rows)
6. Organize by proper construction scope categories

Trade: ${trade?.name || "General"}
${data.description ? `Project Context: ${data.description}` : ""}

Raw imported items:
${rawItemsList}

Return a JSON object with an "items" key containing an array of objects with exactly these fields:
- "category": A proper construction scope category (e.g., "GENERAL REQUIREMENTS", "MATERIALS AND SPECIFICATIONS", "METHODOLOGY AND SEQUENCING", "QUALITY ASSURANCE AND TESTING", "HEALTH AND SAFETY", "WARRANTIES AND DEFECTS LIABILITY", "EXCLUSIONS AND LIMITATIONS", "HANDOVER AND COMPLETION", etc.)
- "description": A concise but complete description of the scope item (1-2 sentences, professional language)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)
- "status": Always "INCLUDED"

Maintain all original intent but improve quality, clarity, and completeness. Keep the total count similar (within +/- 20% of original) unless many items are clearly duplicates or not scope items.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "AI failed to format the items. Please try again or import without AI formatting." });
      }

      const aiItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || Object.values(parsed)[0]);
      if (Array.isArray(aiItems)) {
        finalItems = aiItems
          .filter((item: any) => item.description && typeof item.description === "string")
          .map((item: any) => ({
            category: item.category || "General",
            description: item.description,
            details: item.details || "",
          }));
      }
    }

    const result = await db.transaction(async (tx) => {
      const [newScope] = await tx.insert(scopes).values({
        companyId,
        name: data.name,
        tradeId: data.tradeId,
        jobTypeId: data.jobTypeId || null,
        description: data.description || null,
        status: "DRAFT",
        source: "IMPORTED",
        createdById: userId,
        updatedById: userId,
      }).returning();

      if (finalItems.length > 0) {
        await tx.insert(scopeItems).values(
          finalItems.map((item: any, idx: number) => ({
            companyId,
            scopeId: newScope.id,
            category: item.category || "General",
            description: item.description,
            details: item.details || null,
            status: "INCLUDED" as const,
            sortOrder: idx + 1,
          }))
        );
      }

      return newScope;
    });

    res.json({
      scope: result,
      items: finalItems,
      count: finalItems.length,
      aiFormatted: data.aiFormat,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating imported scope");
    res.status(500).json({ message: "Failed to create scope from import" });
  }
});

router.post("/api/scopes/:id/import", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    if (!(await verifyScopeOwnership(companyId, id))) {
      return res.status(404).json({ message: "Scope not found" });
    }

    const importSchema = z.object({
      items: z.array(z.object({
        category: z.string().nullable().optional(),
        description: z.string().min(1),
        details: z.string().nullable().optional(),
        status: z.enum(["INCLUDED", "EXCLUDED", "NA"]).optional(),
      })),
    });
    const { items } = importSchema.parse(req.body);

    const maxSort = await db
      .select({ max: sql<number>`coalesce(max(${scopeItems.sortOrder}), -1)` })
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)));

    let nextSort = (maxSort[0]?.max || 0) + 1;

    const inserted = await db.insert(scopeItems).values(
      items.map((item, idx) => ({
        scopeId: id,
        companyId,
        category: item.category || null,
        description: item.description,
        details: item.details || null,
        status: (item.status || "INCLUDED") as any,
        isCustom: false,
        sortOrder: nextSort + idx,
      }))
    ).returning();

    res.json({ message: "Import complete", imported: inserted.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error importing scope items");
    res.status(500).json({ message: "Failed to import scope items" });
  }
});

router.get("/api/scopes/:id/export", requireAuth, requirePermission("scopes", "VIEW"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = req.params.id as string;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid ID format" });

    const [scope] = await db
      .select({
        scope: scopes,
        tradeName: scopeTrades.name,
        jobTypeName: jobTypes.name,
      })
      .from(scopes)
      .leftJoin(scopeTrades, eq(scopes.tradeId, scopeTrades.id))
      .leftJoin(jobTypes, eq(scopes.jobTypeId, jobTypes.id))
      .where(and(eq(scopes.id, id), eq(scopes.companyId, companyId)))
      .limit(1);

    if (!scope) return res.status(404).json({ message: "Scope not found" });

    const items = await db
      .select()
      .from(scopeItems)
      .where(and(eq(scopeItems.scopeId, id), eq(scopeItems.companyId, companyId)))
      .orderBy(asc(scopeItems.sortOrder))
      .limit(1000);

    res.json({
      name: scope.scope.name,
      description: scope.scope.description,
      trade: scope.tradeName,
      jobType: scope.jobTypeName,
      status: scope.scope.status,
      source: scope.scope.source,
      isTemplate: scope.scope.isTemplate,
      exportedAt: new Date().toISOString(),
      items: items.map((item) => ({
        category: item.category,
        description: item.description,
        details: item.details,
        status: item.status,
      })),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error exporting scope");
    res.status(500).json({ message: "Failed to export scope" });
  }
});

export default router;
