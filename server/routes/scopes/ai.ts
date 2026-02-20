import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requirePermission } from "../middleware/permissions.middleware";
import logger from "../../lib/logger";
import { db } from "../../db";
import { scopes, scopeItems, scopeTrades, jobTypes } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { verifyTradeOwnership } from "./shared";

const router = Router();
const openai = new OpenAI();

router.post("/api/scopes/ai-generate", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const aiSchema = z.object({
      tradeName: z.string().min(1, "Trade name is required"),
      jobType: z.string().min(1, "Job type is required"),
      projectDescription: z.string().optional(),
    });
    const { tradeName, jobType, projectDescription } = aiSchema.parse(req.body);

    const prompt = `You are an expert construction scope of works consultant in Australia. Generate an extremely detailed and comprehensive scope of works for the following:

Trade: ${tradeName}
Job Type: ${jobType}
${projectDescription ? `Project Description: ${projectDescription}` : ""}

Generate 40-80 highly detailed scope items organized by category. Each item must be specific, measurable, and industry-standard.

Categories MUST include:
1. GENERAL REQUIREMENTS - Insurance, site access, safety plans, inductions, compliance
2. SITE ESTABLISHMENT - Temporary facilities, storage, site offices, amenities
3. MATERIALS AND SPECIFICATIONS - All materials, grades, standards (Australian Standards AS/NZS), tolerances
4. LABOR AND WORKMANSHIP - Qualifications, licensing, supervision ratios, work standards
5. METHODOLOGY AND SEQUENCING - Work procedures, hold points, inspection stages
6. QUALITY ASSURANCE AND TESTING - QA plans, testing requirements, documentation, certifications
7. PROTECTION OF EXISTING WORK - Protection methods, damage rectification, adjacent works
8. ENVIRONMENTAL AND WASTE - Waste management, disposal, recycling, environmental controls
9. HEALTH AND SAFETY - WHS requirements, SWMS, PPE, emergency procedures
10. WARRANTIES AND DEFECTS LIABILITY - Defects liability period, warranty terms, rectification obligations
11. EXCLUSIONS AND LIMITATIONS - What is explicitly excluded from this scope
12. HANDOVER AND COMPLETION - As-built documentation, cleaning, commissioning, handover requirements

Return a JSON array of objects with exactly these fields:
- "category": The category name (from above list)
- "description": A concise but complete description of the scope item (1-2 sentences)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)

Make items EXTREMELY specific to ${tradeName} work. Reference relevant Australian Standards, NCC/BCA requirements, and industry best practices.

Return ONLY the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || parsed.scopeItems || Object.values(parsed)[0]);

    if (!Array.isArray(items)) {
      return res.status(500).json({ message: "AI response did not contain a valid items array" });
    }

    const validItems = items
      .filter((item: any) => item.description && typeof item.description === "string")
      .map((item: any) => ({
        category: item.category || "General",
        description: item.description,
        details: item.details || null,
      }));

    res.json({ items: validItems, count: validItems.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error generating AI scope");
    res.status(500).json({ message: "Failed to generate scope items with AI" });
  }
});

router.post("/api/scopes/ai-create", requireAuth, requirePermission("scopes", "VIEW_AND_UPDATE"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const userId = req.session.userId!;

    const schema = z.object({
      name: z.string().min(1, "Name is required"),
      tradeId: z.string().min(1, "Trade is required"),
      jobTypeId: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    });
    const data = schema.parse(req.body);

    if (!(await verifyTradeOwnership(companyId, data.tradeId))) {
      return res.status(400).json({ message: "Invalid trade" });
    }

    const [trade] = await db.select({ name: scopeTrades.name }).from(scopeTrades).where(eq(scopeTrades.id, data.tradeId)).limit(1);
    let jobTypeName: string | undefined;
    if (data.jobTypeId) {
      const [jt] = await db.select({ id: jobTypes.id, name: jobTypes.name }).from(jobTypes).where(and(eq(jobTypes.id, data.jobTypeId), eq(jobTypes.companyId, companyId))).limit(1);
      if (!jt) return res.status(400).json({ message: "Invalid job type" });
      jobTypeName = jt.name;
    }

    const prompt = `You are an expert construction scope of works consultant in Australia. Generate an extremely detailed and comprehensive scope of works for the following:

Trade: ${trade.name}
${jobTypeName ? `Job Type: ${jobTypeName}` : ""}
${data.description ? `Project Description: ${data.description}` : ""}

Generate 40-80 highly detailed scope items organized by category. Each item must be specific, measurable, and industry-standard.

Categories MUST include:
1. GENERAL REQUIREMENTS - Insurance, site access, safety plans, inductions, compliance
2. SITE ESTABLISHMENT - Temporary facilities, storage, site offices, amenities
3. MATERIALS AND SPECIFICATIONS - All materials, grades, standards (Australian Standards AS/NZS), tolerances
4. LABOR AND WORKMANSHIP - Qualifications, licensing, supervision ratios, work standards
5. METHODOLOGY AND SEQUENCING - Work procedures, hold points, inspection stages
6. QUALITY ASSURANCE AND TESTING - QA plans, testing requirements, documentation, certifications
7. PROTECTION OF EXISTING WORK - Protection methods, damage rectification, adjacent works
8. ENVIRONMENTAL AND WASTE - Waste management, disposal, recycling, environmental controls
9. HEALTH AND SAFETY - WHS requirements, SWMS, PPE, emergency procedures
10. WARRANTIES AND DEFECTS LIABILITY - Defects liability period, warranty terms, rectification obligations
11. EXCLUSIONS AND LIMITATIONS - What is explicitly excluded from this scope
12. HANDOVER AND COMPLETION - As-built documentation, cleaning, commissioning, handover requirements

Return a JSON object with an "items" key containing an array of objects with exactly these fields:
- "category": The category name (from above list)
- "description": A concise but complete description of the scope item (1-2 sentences)
- "details": Additional technical details, specifications, standards references, or clarifications (2-4 sentences)
- "status": Always "INCLUDED"

Make items EXTREMELY specific to ${trade.name} work. Reference relevant Australian Standards, NCC/BCA requirements, and industry best practices.
Include trade-specific items covering: preparation, execution, inspection, documentation, and completion stages.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    const rawItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.scope_items || parsed.scopeItems || Object.values(parsed)[0]);
    if (!Array.isArray(rawItems)) {
      return res.status(500).json({ message: "AI response did not contain valid items" });
    }

    const validItems = rawItems
      .filter((item: any) => item.description && typeof item.description === "string")
      .map((item: any, idx: number) => ({
        category: item.category || "General",
        description: item.description,
        details: item.details || null,
        status: "INCLUDED" as const,
        sortOrder: idx + 1,
      }));

    const [newScope] = await db.insert(scopes).values({
      companyId,
      name: data.name,
      tradeId: data.tradeId,
      jobTypeId: data.jobTypeId || null,
      description: data.description || null,
      status: "DRAFT",
      source: "AI_GENERATED",
      createdById: userId,
      updatedById: userId,
    }).returning();

    if (validItems.length > 0) {
      await db.insert(scopeItems).values(
        validItems.map((item: any) => ({
          companyId,
          scopeId: newScope.id,
          category: item.category,
          description: item.description,
          details: item.details,
          status: item.status,
          sortOrder: item.sortOrder,
        }))
      );
    }

    res.json({
      scope: newScope,
      items: validItems,
      count: validItems.length,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating AI scope");
    res.status(500).json({ message: "Failed to create scope with AI" });
  }
});

export default router;
