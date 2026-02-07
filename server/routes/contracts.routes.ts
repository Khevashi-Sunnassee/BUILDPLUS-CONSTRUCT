import { Router, Request, Response } from "express";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import { contracts, jobs, panelRegister, customers, insertContractSchema } from "@shared/schema";
import { eq, and, sql, max } from "drizzle-orm";
import { z } from "zod";
import OpenAI from "openai";
import multer from "multer";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import crypto from "crypto";
import logger from "../lib/logger";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get("/api/contracts/hub", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const jobsWithStatus = await db
      .select({
        jobId: jobs.id,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
        jobStatus: jobs.status,
        client: jobs.client,
        customerId: jobs.customerId,
        address: jobs.address,
        contractId: contracts.id,
        contractStatus: contracts.contractStatus,
        contractNumber: contracts.contractNumber,
        originalContractValue: contracts.originalContractValue,
        revisedContractValue: contracts.revisedContractValue,
        contractType: contracts.contractType,
        riskRating: contracts.riskRating,
        contractUpdatedAt: contracts.updatedAt,
        maxLifecycleStatus: sql<number>`COALESCE((
          SELECT MAX(pr.lifecycle_status) 
          FROM panel_register pr 
          WHERE pr.job_id = ${jobs.id}
        ), 0)`.as("max_lifecycle_status"),
        panelCount: sql<number>`COALESCE((
          SELECT COUNT(*) 
          FROM panel_register pr 
          WHERE pr.job_id = ${jobs.id}
        ), 0)`.as("panel_count"),
      })
      .from(jobs)
      .leftJoin(contracts, and(eq(contracts.jobId, jobs.id), eq(contracts.companyId, companyId)))
      .where(eq(jobs.companyId, companyId))
      .orderBy(jobs.jobNumber);

    const result = jobsWithStatus.map(row => ({
      jobId: row.jobId,
      jobNumber: row.jobNumber,
      jobName: row.jobName,
      jobStatus: row.jobStatus,
      client: row.client,
      customerId: row.customerId,
      address: row.address,
      contractId: row.contractId,
      contractStatus: row.contractId ? row.contractStatus : "AWAITING_CONTRACT",
      contractNumber: row.contractNumber,
      originalContractValue: row.originalContractValue,
      revisedContractValue: row.revisedContractValue,
      contractType: row.contractType,
      riskRating: row.riskRating,
      contractUpdatedAt: row.contractUpdatedAt,
      panelCount: Number(row.panelCount),
      maxLifecycleStatus: Number(row.maxLifecycleStatus),
      workStatus: Number(row.maxLifecycleStatus) >= 2 ? "In Progress" : "Not Started",
    }));

    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching contract hub");
    res.status(500).json({ error: error.message || "Failed to fetch contract hub" });
  }
});

router.get("/api/contracts/job/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { jobId } = req.params;

    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, jobId), eq(contracts.companyId, companyId)));

    if (!contract) {
      return res.json(null);
    }

    res.json(contract);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching contract by job");
    res.status(500).json({ error: error.message || "Failed to fetch contract" });
  }
});

router.get("/api/contracts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id } = req.params;

    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)));

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    res.json(contract);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching contract");
    res.status(500).json({ error: error.message || "Failed to fetch contract" });
  }
});

router.post("/api/contracts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const data = { ...req.body, companyId };

    const [existing] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, data.jobId), eq(contracts.companyId, companyId)));

    if (existing) {
      return res.status(409).json({ error: "Contract already exists for this job" });
    }

    const [contract] = await db.insert(contracts).values(data).returning();
    res.status(201).json(contract);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating contract");
    res.status(500).json({ error: error.message || "Failed to create contract" });
  }
});

router.patch("/api/contracts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)));

    if (!existing) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.companyId;
    delete updateData.createdAt;

    const [updated] = await db
      .update(contracts)
      .set(updateData)
      .where(and(eq(contracts.id, id), eq(contracts.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating contract");
    res.status(500).json({ error: error.message || "Failed to update contract" });
  }
});

router.post("/api/contracts/ai-analyze", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileContent = file.buffer.toString("base64");
    const mimeType = file.mimetype;

    const contractFields = `
CONTRACT FIELDS TO EXTRACT:
1. Core Contract Identification:
   - contractNumber, projectName, projectAddress, ownerClientName, generalContractor, architectEngineer
   - contractType (one of: LUMP_SUM, UNIT_PRICE, TIME_AND_MATERIALS, GMP)
   - originalContractDate, noticeToProceedDate (ISO date format)

2. Financial & Commercial Terms:
   - originalContractValue, revisedContractValue (numbers only)
   - unitPrices, retentionPercentage, retentionCap
   - paymentTerms, billingMethod, taxResponsibility
   - escalationClause (true/false), escalationClauseDetails
   - liquidatedDamagesRate, liquidatedDamagesStartDate

3. Scope of Work (Precast-Specific):
   - precastScopeDescription
   - precastElementsIncluded (object with boolean: panels, beams, columns, doubleTees, hollowCore, stairs)
   - estimatedPieceCount, estimatedTotalWeight, estimatedTotalVolume
   - finishRequirements, connectionTypeResponsibility

4. Schedule & Milestones:
   - requiredDeliveryStartDate, requiredDeliveryEndDate
   - productionStartDate, productionFinishDate
   - erectionStartDate, erectionFinishDate
   - criticalMilestones, weekendNightWorkAllowed (true/false), weatherAllowances

5. Engineering & Submittals:
   - designResponsibility, shopDrawingRequired (true/false)
   - submittalDueDate, submittalApprovalDate
   - revisionCount, connectionDesignIncluded (true/false), stampedCalculationsRequired (true/false)

6. Logistics & Site Constraints:
   - deliveryRestrictions, siteAccessConstraints, craneTypeCapacity
   - unloadingResponsibility, laydownAreaAvailable (true/false), returnLoadsAllowed (true/false)

7. Change Management:
   - approvedChangeOrderValue, pendingChangeOrderValue
   - changeOrderCount, changeOrderReferenceNumbers, changeReasonCodes, timeImpactDays

8. Risk, Legal & Compliance:
   - performanceBondRequired (true/false), paymentBondRequired (true/false)
   - insuranceRequirements, warrantyPeriod
   - indemnificationClauseNotes, disputeResolutionMethod, governingLaw
   - forceMajeureClause (true/false)

9. Quality & Acceptance:
   - qualityStandardReference, mockupsRequired (true/false)
   - acceptanceCriteria, punchListResponsibility, finalAcceptanceDate

10. Closeout & Completion:
   - substantialCompletionDate, finalCompletionDate, finalRetentionReleaseDate
   - asBuiltsRequired (true/false), omManualsRequired (true/false)
   - warrantyStartDate, warrantyEndDate
`;

    const systemPrompt = `You are an expert construction contract legal adviser specializing in precast concrete contracts. Analyze the uploaded contract document and:

1. Extract all possible contract field values from the document.
2. Provide a risk assessment with a rating from 1-10 (1 = very low risk, 10 = extreme risk).
3. Identify and highlight major risks, unfavorable terms, and areas of concern.
4. Provide a comprehensive risk overview summary.

${contractFields}

IMPORTANT: Return ONLY valid JSON with this exact structure:
{
  "extractedFields": { <field names from above with their values, use null for fields not found> },
  "riskRating": <number 1-10>,
  "riskOverview": "<comprehensive risk assessment summary paragraph>",
  "riskHighlights": [
    { "category": "<Risk Category>", "severity": "HIGH|MEDIUM|LOW", "description": "<description of the risk>" }
  ]
}

For date fields, use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
For boolean fields, use true/false.
For numeric fields, use numbers without currency symbols.
Be thorough in your risk analysis - this serves as legal advisory for the precast company.`;

    let messages: any[];

    if (mimeType === "application/pdf") {
      const pdfData = await pdfParse(file.buffer);
      const pdfText = pdfData.text.slice(0, 100000);
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Please analyze this contract document, extract all relevant fields, and provide a comprehensive risk assessment.\n\n--- CONTRACT TEXT ---\n${pdfText}`,
        },
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${fileContent}`,
              },
            },
            {
              type: "text",
              text: "Please analyze this contract document, extract all relevant fields, and provide a comprehensive risk assessment.",
            },
          ],
        },
      ];
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { extractedFields: {}, riskRating: 5, riskOverview: "Unable to parse AI response", riskHighlights: [] };
    }

    const storageKey = `.private/contracts/${companyId}/${crypto.randomUUID()}_${file.originalname}`;
    await objectStorageService.uploadFile(storageKey, file.buffer, file.mimetype);

    const fileSha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");

    res.json({
      ...parsed,
      fileInfo: {
        storageKey,
        fileName: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileSha256,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error analyzing contract with AI");
    res.status(500).json({ error: error.message || "Failed to analyze contract" });
  }
});

export const contractsRouter = router;
