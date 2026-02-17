import { Router, Request, Response } from "express";
import { requireAuth } from "./middleware/auth.middleware";
import { db } from "../db";
import { contracts, jobs, panelRegister, customers, insertContractSchema } from "@shared/schema";
import { eq, and, sql, max } from "drizzle-orm";
import { z } from "zod";
import OpenAI from "openai";
import multer from "multer";
import mammoth from "mammoth";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import crypto from "crypto";
import logger from "../lib/logger";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const objectStorageService = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/gif", "text/plain"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: PDF, DOC, DOCX, JPEG, PNG, GIF, TXT"));
    }
  },
});

const updateContractSchema = insertContractSchema.partial().omit({ companyId: true });

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
      .orderBy(jobs.jobNumber)
      .limit(Math.min(parseInt(req.query.limit as string) || 500, 1000));

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
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching contract hub");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch contract hub" });
  }
});

router.get("/api/contracts/job/:jobId", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const jobId = String(req.params.jobId);

    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, jobId), eq(contracts.companyId, companyId))!)
      .limit(1);

    if (!contract) {
      return res.json(null);
    }

    res.json(contract);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching contract by job");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch contract" });
  }
});

router.get("/api/contracts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);

    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.companyId, companyId))!)
      .limit(1);

    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    res.json(contract);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching contract");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch contract" });
  }
});

router.post("/api/contracts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;

    const parsed = insertContractSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const data = parsed.data;

    const [existing] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.jobId, data.jobId), eq(contracts.companyId, companyId))!)
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: "Contract already exists for this job" });
    }

    const [contract] = await db.insert(contracts).values({ ...data, companyId } as typeof contracts.$inferInsert).returning();
    res.status(201).json(contract);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating contract");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create contract" });
  }
});

router.patch("/api/contracts/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);

    const [existing] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.companyId, companyId))!)
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const parsed = updateContractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { version: clientVersion, ...rest } = parsed.data as Record<string, unknown>;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date(), version: sql`${contracts.version} + 1` };

    const updated = await db.transaction(async (tx) => {
      const whereClause = clientVersion !== undefined
        ? and(eq(contracts.id, id), eq(contracts.companyId, companyId), eq(contracts.version, clientVersion as number))
        : and(eq(contracts.id, id), eq(contracts.companyId, companyId));

      const [contractResult] = await tx
        .update(contracts)
        .set(updateData as Record<string, unknown>)
        .where(whereClause!)
        .returning();

      if (!contractResult) {
        throw Object.assign(new Error("Contract was modified by another user. Please refresh and try again."), { statusCode: 409 });
      }

      if (updateData.requiredDeliveryStartDate !== undefined) {
        const newDate = updateData.requiredDeliveryStartDate ? new Date(updateData.requiredDeliveryStartDate as string) : null;
        await tx.update(jobs)
          .set({ productionStartDate: newDate })
          .where(and(eq(jobs.id, existing.jobId), eq(jobs.companyId, companyId))!);
      }

      return contractResult;
    });

    res.json(updated);
  } catch (error: unknown) {
    if (error instanceof Error && (error as unknown as Record<string, unknown>).statusCode === 409) {
      return res.status(409).json({ error: error.message });
    }
    logger.error({ err: error }, "Error updating contract");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update contract" });
  }
});

router.post("/api/contracts/ai-analyze", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const companyId = req.session.companyId!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBase64 = file.buffer.toString("base64");
    const mimeType = file.mimetype;
    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";
    const isWord = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || mimeType === "application/msword";

    const contractFieldsPrompt = `
You MUST extract values for the following contract fields. For each field, return its exact key name with the extracted value, or null if not found in the document.

SECTION 1 - Core Contract Identification:
  contractNumber (string) - The contract or subcontract reference number
  projectName (string) - Name of the project
  projectAddress (string) - Street address / location of the project
  ownerClientName (string) - Name of the property owner or principal client
  generalContractor (string) - Name of the head/general contractor
  architectEngineer (string) - Name of the architect or engineer of record
  contractType (string, one of: "LUMP_SUM", "UNIT_PRICE", "TIME_AND_MATERIALS", "GMP") - Type of contract pricing
  originalContractDate (ISO date string, e.g. "2025-03-15") - Date the contract was originally executed
  noticeToProceedDate (ISO date string) - Date notice to proceed was issued

SECTION 2 - Financial & Commercial Terms:
  originalContractValue (number) - Original total contract value in dollars, no currency symbols
  revisedContractValue (number) - Revised contract value if amended, no currency symbols
  unitPrices (string) - Description of any unit pricing arrangements
  retentionPercentage (number) - Retention percentage held, e.g. 10
  retentionCap (number) - Maximum retention cap percentage, e.g. 5
  paymentTerms (string) - Payment period terms, e.g. "Net 30"
  billingMethod (string) - How billing is structured, e.g. "Progress claims"
  taxResponsibility (string) - Who is responsible for applicable taxes
  escalationClause (boolean) - Whether the contract has an escalation/rise-and-fall clause
  escalationClauseDetails (string) - Details of any escalation provisions
  liquidatedDamagesRate (string) - Rate of liquidated damages, e.g. "$5,000 per day"
  liquidatedDamagesStartDate (ISO date string) - Date from which LDs apply

SECTION 3 - Scope of Work (Precast-Specific):
  precastScopeDescription (string) - Description of precast concrete scope of works
  precastElementsIncluded (object with boolean values: { panels, beams, columns, doubleTees, hollowCore, stairs }) - Which precast element types are included
  estimatedPieceCount (integer) - Total estimated number of precast pieces
  estimatedTotalWeight (string) - Total estimated weight, e.g. "2,500 tonnes"
  estimatedTotalVolume (string) - Total estimated concrete volume, e.g. "1,200 m3"
  finishRequirements (string) - Surface finish requirements for precast elements
  connectionTypeResponsibility (string) - Who designs/supplies connections

SECTION 4 - Schedule & Milestones:
  requiredDeliveryStartDate (ISO date string) - When deliveries to site must commence
  requiredDeliveryEndDate (ISO date string) - When all deliveries must be completed
  productionStartDate (ISO date string) - When production/casting must begin
  productionFinishDate (ISO date string) - When production must be finished
  erectionStartDate (ISO date string) - When erection/installation begins
  erectionFinishDate (ISO date string) - When erection must be completed
  criticalMilestones (string) - Key milestones and deadlines noted in the contract
  weekendNightWorkAllowed (boolean) - Whether weekend or night work is permitted
  weatherAllowances (string) - Any weather-related allowances or provisions

SECTION 5 - Engineering & Submittals:
  designResponsibility (string) - Who is responsible for design, e.g. "Design & Construct" or "Construct Only"
  shopDrawingRequired (boolean) - Whether shop drawings are required
  submittalDueDate (ISO date string) - When submittals are due
  submittalApprovalDate (ISO date string) - Expected approval date for submittals
  revisionCount (integer) - Number of revisions allowed or mentioned
  connectionDesignIncluded (boolean) - Whether connection design is included in scope
  stampedCalculationsRequired (boolean) - Whether stamped engineering calculations are needed

SECTION 6 - Logistics & Site Constraints:
  deliveryRestrictions (string) - Any restrictions on delivery times, routes, vehicle sizes
  siteAccessConstraints (string) - Site access limitations
  craneTypeCapacity (string) - Crane requirements and capacity
  unloadingResponsibility (string) - Who is responsible for unloading at site
  laydownAreaAvailable (boolean) - Whether a laydown/staging area is available on site
  returnLoadsAllowed (boolean) - Whether return/back-loading is permitted

SECTION 7 - Change Management:
  approvedChangeOrderValue (number) - Total value of approved change orders
  pendingChangeOrderValue (number) - Total value of pending change orders
  changeOrderCount (integer) - Number of change orders
  changeOrderReferenceNumbers (string) - Reference numbers for change orders
  changeReasonCodes (string) - Codes or descriptions for change order reasons
  timeImpactDays (integer) - Total days of time impact from changes

SECTION 8 - Risk, Legal & Compliance:
  performanceBondRequired (boolean) - Whether a performance bond is required
  paymentBondRequired (boolean) - Whether a payment bond is required
  insuranceRequirements (string) - Insurance requirements and minimum coverage
  warrantyPeriod (string) - Warranty/defects liability period, e.g. "12 months"
  indemnificationClauseNotes (string) - Key notes about indemnification obligations
  disputeResolutionMethod (string) - How disputes are resolved, e.g. "Arbitration", "Litigation"
  governingLaw (string) - Governing law jurisdiction, e.g. "Victoria, Australia"
  forceMajeureClause (boolean) - Whether there is a force majeure clause

SECTION 9 - Quality & Acceptance:
  qualityStandardReference (string) - Referenced quality standards, e.g. "AS 3610"
  mockupsRequired (boolean) - Whether mockup panels or samples are required
  acceptanceCriteria (string) - Criteria for accepting completed work
  punchListResponsibility (string) - Who handles defect/punch list items
  finalAcceptanceDate (ISO date string) - Date of final acceptance

SECTION 10 - Closeout & Completion:
  substantialCompletionDate (ISO date string) - Substantial/practical completion date
  finalCompletionDate (ISO date string) - Final completion date
  finalRetentionReleaseDate (ISO date string) - When retention monies are released
  asBuiltsRequired (boolean) - Whether as-built drawings are required
  omManualsRequired (boolean) - Whether O&M manuals are required
  warrantyStartDate (ISO date string) - When warranty period starts
  warrantyEndDate (ISO date string) - When warranty period ends
`;

    const systemPrompt = `You are a senior construction contract legal adviser specialising in precast concrete subcontracts.
You are advising a SUBCONTRACTOR (the precast manufacturer/supplier/installer) reviewing a contract they have been given by a head contractor or principal.

Your job is to:
1. EXTRACT all contract field values from the document and map them to the required fields below.
2. ASSESS RISKS from the subcontractor's perspective — flag anything that exposes the subcontractor to financial loss, unfair liability, unreasonable timelines, onerous terms, or missing protections.
3. Provide a RISK RATING from 1 to 10 (1 = minimal risk, 10 = extremely high risk for the subcontractor).
4. Write a clear RISK OVERVIEW summary paragraph that a non-lawyer can understand, highlighting the most important concerns.

${contractFieldsPrompt}

Return ONLY valid JSON with this exact structure (no markdown, no code fences, no explanation outside the JSON):
{
  "extractedFields": {
    "contractNumber": "value or null",
    "projectName": "value or null",
    ... (include ALL field keys listed above, using null for fields not found)
  },
  "riskRating": 7,
  "riskOverview": "A plain-English paragraph summarising the key risks this contract poses to the subcontractor, what to watch out for, and any recommended actions before signing.",
  "riskHighlights": [
    {
      "category": "Payment Terms",
      "severity": "HIGH",
      "description": "Specific description of the risk and why it matters to the subcontractor"
    }
  ]
}

RULES:
- Date values must be ISO 8601 format: "YYYY-MM-DD" (e.g. "2025-06-15"). Do NOT include time components.
- Boolean values must be true or false (not strings).
- Numeric values must be plain numbers without currency symbols, commas, or units.
- For precastElementsIncluded, return an object like { "panels": true, "beams": false, "columns": false, "doubleTees": false, "hollowCore": false, "stairs": false }.
- If a field cannot be determined from the document, use null.
- Risk highlights should have severity "HIGH", "MEDIUM", or "LOW".
- Focus risk analysis on: payment security, retention terms, liquidated damages exposure, design risk transfer, insurance burden, indemnification, time constraints, and unfair termination clauses.`;

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    if (isWord) {
      let extractedText = "";
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } catch (extractErr) {
        logger.warn({ err: extractErr }, "Failed to extract text from Word document, sending as-is");
        extractedText = file.buffer.toString("utf-8");
      }

      if (!extractedText || extractedText.trim().length < 50) {
        return res.status(400).json({ error: "Could not extract sufficient text from the Word document. Please try uploading a PDF version instead." });
      }

      userContent.push({
        type: "text",
        text: `Here is the full text of the contract document (extracted from "${file.originalname}"):\n\n---\n${extractedText}\n---\n\nPlease analyze this contract, extract all field values, and provide a risk assessment from the subcontractor's perspective.`,
      });
    } else if (isPdf || isImage) {
      const dataUri = `data:${mimeType};base64,${fileBase64}`;

      userContent.push({
        type: "image_url",
        image_url: {
          url: dataUri,
          detail: "high",
        },
      });
      userContent.push({
        type: "text",
        text: `This is a contract document ("${file.originalname}"). Please carefully read every page, extract all field values, and provide a thorough risk assessment from the subcontractor's perspective.`,
      });
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, Word document, or image file." });
    }

    logger.info({ fileName: file.originalname, mimeType, fileSize: file.size }, "Starting AI contract analysis");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_completion_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    logger.info({ responseLength: responseText.length }, "AI contract analysis response received");

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      logger.error({ err: parseErr, responseText: responseText.substring(0, 500) }, "Failed to parse AI response as JSON");
      parsed = { extractedFields: {}, riskRating: 5, riskOverview: "The AI returned an invalid response. Please try again.", riskHighlights: [] };
    }

    if (!parsed.extractedFields) parsed.extractedFields = {};
    if (!parsed.riskHighlights) parsed.riskHighlights = [];
    if (!parsed.riskRating) parsed.riskRating = 5;
    if (!parsed.riskOverview) parsed.riskOverview = "No risk overview available.";

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
  } catch (error: unknown) {
    logger.error({ err: error, stack: error instanceof Error ? error.stack : undefined }, "Error analyzing contract with AI");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to analyze contract" });
  }
});

export const contractsRouter = router;
