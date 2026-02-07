import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { db } from "../db";
import { assets, assetMaintenanceRecords, assetTransfers, ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, ASSET_FUNDING_METHODS } from "@shared/schema";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import OpenAI from "openai";
import logger from "../lib/logger";

const router = Router();

const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  fundingMethod: z.string().optional().nullable(),
  purchasePrice: z.any().optional().nullable(),
  currentValue: z.any().optional().nullable(),
  depreciationMethod: z.string().optional().nullable(),
  depreciationRate: z.any().optional().nullable(),
  accumulatedDepreciation: z.any().optional().nullable(),
  depreciationThisPeriod: z.any().optional().nullable(),
  bookValue: z.any().optional().nullable(),
  yearsDepreciated: z.number().optional().nullable(),
  usefulLifeYears: z.number().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  leaseStartDate: z.string().optional().nullable(),
  leaseEndDate: z.string().optional().nullable(),
  leaseMonthlyPayment: z.any().optional().nullable(),
  balloonPayment: z.any().optional().nullable(),
  leaseTerm: z.number().optional().nullable(),
  lessor: z.string().optional().nullable(),
  loanAmount: z.any().optional().nullable(),
  interestRate: z.any().optional().nullable(),
  loanTerm: z.number().optional().nullable(),
  lender: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  registrationNumber: z.string().optional().nullable(),
  engineNumber: z.string().optional().nullable(),
  vinNumber: z.string().optional().nullable(),
  yearOfManufacture: z.string().optional().nullable(),
  countryOfOrigin: z.string().optional().nullable(),
  specifications: z.string().optional().nullable(),
  operatingHours: z.any().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNumber: z.string().optional().nullable(),
  insurancePremium: z.any().optional().nullable(),
  insuranceExcess: z.any().optional().nullable(),
  insuranceStartDate: z.string().optional().nullable(),
  insuranceExpiryDate: z.string().optional().nullable(),
  insuranceStatus: z.string().optional().nullable(),
  insuranceNotes: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  barcode: z.string().optional().nullable(),
  qrCode: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  capexRequestId: z.string().optional().nullable(),
  capexDescription: z.string().optional().nullable(),
  photos: z.any().optional().nullable(),
}).passthrough();

const createMaintenanceSchema = z.object({
  maintenanceType: z.string().min(1, "Maintenance type is required"),
  maintenanceDate: z.string().min(1, "Date is required"),
  cost: z.any().optional().nullable(),
  serviceProvider: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

const createTransferSchema = z.object({
  transferDate: z.string().min(1, "Transfer date is required"),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  fromDepartment: z.string().optional().nullable(),
  toDepartment: z.string().optional().nullable(),
  fromAssignee: z.string().optional().nullable(),
  toAssignee: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function generateAssetTag(companyId: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `AST-${yy}${mm}-`;
  const result = await db.select({ tag: assets.assetTag })
    .from(assets)
    .where(and(eq(assets.companyId, companyId), ilike(assets.assetTag, `${prefix}%`)))
    .orderBy(desc(assets.assetTag))
    .limit(1);
  let nextNum = 1;
  if (result.length > 0) {
    const lastTag = result[0].tag;
    const lastNum = parseInt(lastTag.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

router.get("/api/admin/assets", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const result = await db.select().from(assets)
      .where(eq(assets.companyId, companyId))
      .orderBy(desc(assets.createdAt));
    res.json(result);
  } catch (error: any) {
    logger.error("Failed to fetch assets", { error: error.message });
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

router.get("/api/admin/assets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (error: any) {
    logger.error("Failed to fetch asset", { error: error.message });
    res.status(500).json({ error: "Failed to fetch asset" });
  }
});

router.post("/api/admin/assets", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = createAssetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const assetTag = await generateAssetTag(companyId);
    const data = {
      ...parsed.data,
      companyId,
      assetTag,
      createdBy: req.session?.userId || null,
    };
    const [created] = await db.insert(assets).values(data).returning();
    res.status(201).json(created);
  } catch (error: any) {
    logger.error("Failed to create asset", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to create asset" });
  }
});

router.put("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });

    const parsed = createAssetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const { id: _id, companyId: _cid, assetTag: _tag, createdAt: _ca, ...safeData } = parsed.data as any;
    const [updated] = await db.update(assets)
      .set({ ...safeData, updatedAt: new Date() })
      .where(eq(assets.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error: any) {
    logger.error("Failed to update asset", { error: error.message });
    res.status(500).json({ error: error.message || "Failed to update asset" });
  }
});

router.delete("/api/admin/assets/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [existing] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!existing) return res.status(404).json({ error: "Asset not found" });
    await db.delete(assets).where(eq(assets.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Failed to delete asset", { error: error.message });
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

router.post("/api/admin/assets/:id/ai-summary", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    if (!asset.manufacturer && !asset.model) {
      return res.status(400).json({ error: "Manufacturer and model are required for AI analysis" });
    }

    const maintenanceHistory = await db.select().from(assetMaintenanceRecords)
      .where(eq(assetMaintenanceRecords.assetId, asset.id))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate))
      .limit(10);

    const prompt = `Analyze this construction/manufacturing asset and provide a comprehensive summary:

Asset: ${asset.name}
Manufacturer: ${asset.manufacturer || 'Unknown'}
Model: ${asset.model || 'Unknown'}
Category: ${asset.category}
Condition: ${asset.condition || 'Not assessed'}
Year of Manufacture: ${asset.yearOfManufacture || 'Unknown'}
Purchase Price: ${asset.purchasePrice ? `$${asset.purchasePrice}` : 'Unknown'}
Current Value: ${asset.currentValue ? `$${asset.currentValue}` : 'Unknown'}
Operating Hours: ${asset.operatingHours || 'Unknown'}
Serial Number: ${asset.serialNumber || 'N/A'}
Status: ${asset.status || 'active'}
${maintenanceHistory.length > 0 ? `\nRecent Maintenance (${maintenanceHistory.length} records):\n${maintenanceHistory.map(m => `- ${m.maintenanceDate}: ${m.maintenanceType} - ${m.description || 'No details'} ($${m.cost || '0'})`).join('\n')}` : ''}

Please provide:
1. Asset Overview & Market Context
2. Expected Remaining Useful Life
3. Current Market Value Assessment
4. Recommended Maintenance Schedule
5. Risk Assessment & Recommendations
6. Depreciation Analysis

Format as clean HTML with headings and bullet points.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an asset management specialist for construction and manufacturing companies. Provide practical, data-driven analysis." },
        { role: "user", content: prompt },
      ],
      max_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content || "";
    const [updated] = await db.update(assets)
      .set({ aiSummary: summary, updatedAt: new Date() })
      .where(eq(assets.id, asset.id))
      .returning();
    res.json({ aiSummary: summary });
  } catch (error: any) {
    logger.error("Failed to generate AI summary", { error: error.message });
    res.status(500).json({ error: "Failed to generate AI summary" });
  }
});

router.get("/api/admin/assets/:id/maintenance", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const records = await db.select().from(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.assetId, req.params.id), eq(assetMaintenanceRecords.companyId, companyId)))
      .orderBy(desc(assetMaintenanceRecords.maintenanceDate));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch maintenance records" });
  }
});

router.post("/api/admin/assets/:id/maintenance", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetMaintenanceRecords).values({
      ...parsed.data,
      assetId: req.params.id,
      companyId,
      createdBy: req.session?.userId || null,
    }).returning();
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create maintenance record" });
  }
});

router.delete("/api/admin/assets/:assetId/maintenance/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetMaintenanceRecords)
      .where(and(eq(assetMaintenanceRecords.id, req.params.id), eq(assetMaintenanceRecords.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete maintenance record" });
  }
});

router.get("/api/admin/assets/:id/transfers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const records = await db.select().from(assetTransfers)
      .where(and(eq(assetTransfers.assetId, req.params.id), eq(assetTransfers.companyId, companyId)))
      .orderBy(desc(assetTransfers.transferDate));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch transfer records" });
  }
});

router.post("/api/admin/assets/:id/transfers", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const [asset] = await db.select().from(assets)
      .where(and(eq(assets.id, req.params.id), eq(assets.companyId, companyId)));
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const parsed = createTransferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    }
    const [record] = await db.insert(assetTransfers).values({
      ...parsed.data,
      assetId: req.params.id,
      companyId,
      transferredBy: req.session?.userId || null,
    }).returning();

    const updateFields: any = {};
    if (parsed.data.toLocation) updateFields.location = parsed.data.toLocation;
    if (parsed.data.toDepartment) updateFields.department = parsed.data.toDepartment;
    if (parsed.data.toAssignee) updateFields.assignedTo = parsed.data.toAssignee;
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await db.update(assets).set(updateFields).where(eq(assets.id, req.params.id));
    }

    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create transfer record" });
  }
});

router.delete("/api/admin/assets/:assetId/transfers/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    await db.delete(assetTransfers)
      .where(and(eq(assetTransfers.id, req.params.id), eq(assetTransfers.companyId, companyId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete transfer record" });
  }
});

export const assetsRouter = router;
