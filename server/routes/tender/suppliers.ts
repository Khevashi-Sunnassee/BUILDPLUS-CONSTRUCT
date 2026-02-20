import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { tenders, tenderMembers, suppliers, jobs, costCodes, jobTypes } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { isValidId, verifyTenderOwnership, calculateSearchRadius } from "./shared";

const router = Router();

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
      .where(and(inArray(costCodes.id, data.costCodeIds), eq(costCodes.companyId, companyId)))
      .limit(1000);

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

    const bodySchema = z.object({
      suppliers: z.array(supplierSchema).min(1, "At least one supplier is required"),
      defaultCostCodeId: z.string().nullable().optional(),
    });

    const data = bodySchema.parse(req.body);

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

export default router;
