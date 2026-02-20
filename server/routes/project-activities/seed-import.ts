import { Router } from "express";
import ExcelJS from "exceljs";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../../db";
import {
  jobTypes, activityStages, activityConsultants,
  activityTemplates,
} from "@shared/schema";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { upload } from "./shared";

const router = Router();

router.post("/api/activity-seed", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;

    const existingStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .limit(200);
    if (existingStages.length > 0) {
      return res.status(400).json({ error: "Seed data already exists for this company" });
    }

    const stagesData = [
      { stageNumber: 1, name: "Strategy & Feasibility" },
      { stageNumber: 2, name: "Site Acquisition" },
      { stageNumber: 3, name: "Concept & Planning Strategy" },
      { stageNumber: 4, name: "Planning Approval" },
      { stageNumber: 5, name: "Detailed Design & Building Approval" },
      { stageNumber: 6, name: "Procurement" },
      { stageNumber: 7, name: "Construction" },
      { stageNumber: 8, name: "Commissioning & Occupancy" },
      { stageNumber: 9, name: "Settlement & Handover" },
      { stageNumber: 10, name: "Defects & Stabilisation" },
    ];

    const consultantsData = [
      "Agent", "Architect", "Asset Manager", "Builder", "Builder / Consultants",
      "Builder / Façade Engineer", "Builder / PM", "Builder / Structural Engineer",
      "Building Surveyor", "Civil Engineer", "Commissioning Manager",
      "Development Manager", "Development Manager / QS", "Environmental Consultant",
      "ESD Consultant", "Fire Engineer", "Geotechnical Engineer", "Landscape Architect",
      "Lawyer / Developer", "Licensed Surveyor", "Market Research Consultant",
      "MEP / ESD Consultants", "MEP Contractors", "MEP Engineers",
      "PCA / Consultants", "PM / QS", "Property Lawyer", "QS / PM",
      "Quantity Surveyor", "Strata Manager / Lawyer", "Structural Engineer",
      "Superintendent / PM", "Surveyor", "Town Planner", "Town Planner / Lawyer",
      "Traffic Engineer", "Various Consultants",
    ];

    const jobTypesData = [
      { name: "Construction Only", description: "Construction-only projects" },
      { name: "Development to Construction", description: "Full development lifecycle from feasibility to construction" },
      { name: "Manufacturing", description: "Manufacturing and production projects" },
      { name: "Procurement", description: "Procurement-focused projects" },
    ];

    await db.transaction(async (tx) => {
      const createdStages: { id: string; stageNumber: number; [key: string]: unknown }[] = [];
      for (let i = 0; i < stagesData.length; i++) {
        const [s] = await tx.insert(activityStages).values({
          ...stagesData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdStages.push(s);
      }

      const createdConsultants: Record<string, string> = {};
      for (let i = 0; i < consultantsData.length; i++) {
        const [c] = await tx.insert(activityConsultants).values({
          name: consultantsData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdConsultants[consultantsData[i]] = c.id;
      }

      const createdJobTypes: Record<string, unknown>[] = [];
      for (let i = 0; i < jobTypesData.length; i++) {
        const [jt] = await tx.insert(jobTypes).values({
          ...jobTypesData[i],
          companyId: companyId!,
          sortOrder: i,
        }).returning();
        createdJobTypes.push(jt);
      }

      const stageMap: Record<number, string> = {};
      for (const s of createdStages) {
        stageMap[Number(s.stageNumber)] = s.id;
      }

      const activitiesData = [
        { stage: 1, phase: "OPPORTUNITY", cat: "Market Analysis", name: "Undertake market and demand study", days: 5, consultant: "Market Research Consultant", deliverable: "Market demand report" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Feasibility", name: "Prepare high-level development feasibility model", days: 5, consultant: "Development Manager / QS", deliverable: "Feasibility model" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Planning Due Diligence", name: "Review zoning, overlays, planning controls", days: 5, consultant: "Town Planner", deliverable: "Planning due diligence memo" },
        { stage: 1, phase: "OPPORTUNITY", cat: "Concept Design", name: "Prepare test fit / massing options", days: 25, consultant: "Architect", deliverable: "Concept massing drawings" },
        { stage: 1, phase: "CONTRACTED", cat: "Cost Planning", name: "Prepare preliminary cost plan", days: 20, consultant: "Quantity Surveyor", deliverable: "Concept cost plan" },
        { stage: 1, phase: "CONTRACTED", cat: "Risk", name: "Prepare initial development risk register", days: 5, consultant: "Development Manager", deliverable: "Risk register" },
        { stage: 2, phase: "CONTRACTED", cat: "Legal", name: "Review title, easements, covenants", days: 5, consultant: "Property Lawyer", deliverable: "Title due diligence report" },
        { stage: 2, phase: "CONTRACTED", cat: "Surveying", name: "Prepare feature & level survey", days: 15, consultant: "Licensed Surveyor", deliverable: "Feature & level survey" },
        { stage: 2, phase: "CONTRACTED", cat: "Geotechnical", name: "Complete geotechnical investigation", days: 20, consultant: "Geotechnical Engineer", deliverable: "Geotechnical report" },
        { stage: 2, phase: "CONTRACTED", cat: "Environmental", name: "Environmental site assessment (Phase 1)", days: 15, consultant: "Environmental Consultant", deliverable: "Phase 1 ESA report" },
        { stage: 3, phase: "CONTRACTED", cat: "Architecture", name: "Prepare concept design package", days: 25, consultant: "Architect", deliverable: "Concept design report" },
        { stage: 3, phase: "CONTRACTED", cat: "Town Planning", name: "Prepare and submit planning application", days: 20, consultant: "Town Planner", deliverable: "Planning application" },
        { stage: 4, phase: "CONTRACTED", cat: "Town Planning", name: "Respond to RFI from planning authority", days: 10, consultant: "Town Planner / Lawyer", deliverable: "RFI responses" },
        { stage: 4, phase: "CONTRACTED", cat: "Town Planning", name: "Attend planning panel / tribunal (if required)", days: 5, consultant: "Town Planner / Lawyer", deliverable: "Panel/tribunal outcome" },
        { stage: 5, phase: "CONTRACTED", cat: "Architecture", name: "Prepare detailed design documentation", days: 40, consultant: "Architect", deliverable: "Detailed design package" },
        { stage: 5, phase: "CONTRACTED", cat: "Structural", name: "Complete structural design and documentation", days: 30, consultant: "Structural Engineer", deliverable: "Structural drawings" },
        { stage: 5, phase: "CONTRACTED", cat: "Services", name: "Complete MEP design and documentation", days: 30, consultant: "MEP Engineers", deliverable: "MEP drawings" },
        { stage: 5, phase: "CONTRACTED", cat: "Building Approval", name: "Lodge building permit application", days: 10, consultant: "Building Surveyor", deliverable: "Building permit" },
        { stage: 6, phase: "CONTRACTED", cat: "Procurement", name: "Prepare tender packages for trades", days: 15, consultant: "QS / PM", deliverable: "Tender packages" },
        { stage: 6, phase: "CONTRACTED", cat: "Procurement", name: "Evaluate tenders and award contracts", days: 10, consultant: "QS / PM", deliverable: "Award letters" },
        { stage: 7, phase: "CONTRACTED", cat: "Construction", name: "Site establishment and mobilisation", days: 10, consultant: "Builder", deliverable: "Site establishment complete" },
        { stage: 7, phase: "CONTRACTED", cat: "Construction", name: "Substructure / foundations", days: 30, consultant: "Builder / Structural Engineer", deliverable: "Foundation completion" },
        { stage: 7, phase: "CONTRACTED", cat: "Construction", name: "Superstructure", days: 60, consultant: "Builder", deliverable: "Structure complete" },
        { stage: 7, phase: "CONTRACTED", cat: "Construction", name: "Building envelope / façade", days: 40, consultant: "Builder / Façade Engineer", deliverable: "Façade complete" },
        { stage: 7, phase: "CONTRACTED", cat: "Construction", name: "Internal fitout and services rough-in", days: 45, consultant: "Builder / Consultants", deliverable: "Fitout complete" },
        { stage: 8, phase: "CONTRACTED", cat: "Commissioning", name: "Commission building services", days: 15, consultant: "Commissioning Manager", deliverable: "Commissioning certificates" },
        { stage: 8, phase: "CONTRACTED", cat: "Compliance", name: "Obtain occupancy certificate", days: 10, consultant: "PCA / Consultants", deliverable: "Occupancy certificate" },
        { stage: 9, phase: "CONTRACTED", cat: "Settlement", name: "Coordinate settlement and handover", days: 10, consultant: "Strata Manager / Lawyer", deliverable: "Settlement complete" },
        { stage: 10, phase: "CONTRACTED", cat: "Defects", name: "Manage defects liability period", days: 180, consultant: "Superintendent / PM", deliverable: "Final defects report" },
      ];

      const devJobType = createdJobTypes.find((jt: Record<string, unknown>) => jt.name === "Development to Construction") as Record<string, unknown> | undefined;
      if (devJobType) {
        for (let i = 0; i < activitiesData.length; i++) {
          const a = activitiesData[i];
          const stageId = stageMap[a.stage];
          if (!stageId) continue;

          await tx.insert(activityTemplates).values({
            jobTypeId: String(devJobType.id),
            companyId: companyId!,
            stageId,
            category: a.cat,
            name: a.name,
            description: null,
            estimatedDays: a.days,
            consultantId: createdConsultants[a.consultant] || null,
            consultantName: a.consultant,
            deliverable: a.deliverable,
            jobPhase: a.phase,
            sortOrder: i,
          });
        }
      }
    });

    res.status(201).json({ success: true, message: "Seed data created successfully" });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error seeding data");
    res.status(500).json({ error: "Failed to seed data" });
  }
});

router.get("/api/job-types/:jobTypeId/templates/download-template", requireAuth, async (req, res) => {
  try {
    const jobTypeId = String(req.params.jobTypeId);
    const companyId = req.companyId;

    const allStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .orderBy(asc(activityStages.stageNumber))
      .limit(200);

    const allConsultants = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!))
      .orderBy(asc(activityConsultants.sortOrder))
      .limit(200);

    const workbook = new ExcelJS.Workbook();

    const mainSheet = workbook.addWorksheet("Activities");
    mainSheet.columns = [
      { header: "Stage Number", key: "stageNumber", width: 15 },
      { header: "Stage Name", key: "stageName", width: 35 },
      { header: "Category", key: "category", width: 20 },
      { header: "Activity Name", key: "name", width: 40 },
      { header: "Description", key: "description", width: 40 },
      { header: "Estimated Days", key: "estimatedDays", width: 16 },
      { header: "Consultant", key: "consultant", width: 30 },
      { header: "Deliverable", key: "deliverable", width: 30 },
      { header: "Phase", key: "phase", width: 25 },
    ];

    const headerRow = mainSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

    mainSheet.addRow({
      stageNumber: 1,
      stageName: allStages.find(s => s.stageNumber === 1)?.name || "Strategy & Feasibility",
      category: "Architecture",
      name: "Example: Prepare feasibility study",
      description: "Prepare initial feasibility study report",
      estimatedDays: 14,
      consultant: allConsultants[0]?.name || "Architect",
      deliverable: "Feasibility report",
      phase: "OPPORTUNITY",
    });

    const refSheet = workbook.addWorksheet("Reference - Stages");
    refSheet.columns = [
      { header: "Stage Number", key: "stageNumber", width: 15 },
      { header: "Stage Name", key: "stageName", width: 40 },
    ];
    const refHeaderRow = refSheet.getRow(1);
    refHeaderRow.font = { bold: true };
    refHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    for (const stage of allStages) {
      refSheet.addRow({ stageNumber: stage.stageNumber, stageName: stage.name });
    }

    const consultantSheet = workbook.addWorksheet("Reference - Consultants");
    consultantSheet.columns = [
      { header: "#", key: "num", width: 8 },
      { header: "Consultant Name", key: "name", width: 40 },
    ];
    const conHeaderRow = consultantSheet.getRow(1);
    conHeaderRow.font = { bold: true };
    conHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    allConsultants.forEach((c, i) => {
      consultantSheet.addRow({ num: i + 1, name: c.name });
    });

    const phaseSheet = workbook.addWorksheet("Reference - Phases");
    phaseSheet.columns = [
      { header: "Phase Value", key: "phase", width: 30 },
    ];
    const phaseHeaderRow = phaseSheet.getRow(1);
    phaseHeaderRow.font = { bold: true };
    phaseHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    ["OPPORTUNITY", "QUOTING", "WON_AWAITING_CONTRACT", "CONTRACTED", "LOST"].forEach(p => {
      phaseSheet.addRow({ phase: p });
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=workflow_template.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error generating template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/api/job-types/:jobTypeId/templates/import", requireAuth, requireRole("ADMIN", "MANAGER"), upload.single("file"), async (req, res) => {
  try {
    const jobTypeId = String(req.params.jobTypeId);
    const companyId = req.companyId;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const [jobType] = await db.select().from(jobTypes)
      .where(and(eq(jobTypes.id, jobTypeId), eq(jobTypes.companyId, companyId!)))
      .limit(1);
    if (!jobType) {
      return res.status(404).json({ error: "Job type not found" });
    }

    const allStages = await db.select().from(activityStages)
      .where(eq(activityStages.companyId, companyId!))
      .limit(200);
    const stageByNumber = new Map(allStages.map(s => [s.stageNumber, s]));
    const stageByName = new Map(allStages.map(s => [s.name.toLowerCase().trim(), s]));

    const allConsultants = await db.select().from(activityConsultants)
      .where(eq(activityConsultants.companyId, companyId!))
      .limit(200);
    const consultantByName = new Map(allConsultants.map(c => [c.name.toLowerCase().trim(), c]));

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.getWorksheet("Activities") || workbook.getWorksheet(1);
    if (!sheet) {
      return res.status(400).json({ error: "No 'Activities' sheet found in the file" });
    }

    function getCellText(cell: ExcelJS.Cell): string {
      const val = cell.value;
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val.trim();
      if (typeof val === "number" || typeof val === "boolean") return String(val);
      if (typeof val === "object" && val !== null && "richText" in val) {
        return ((val as {richText: {text: string}[]}).richText || []).map((r) => r.text || "").join("").trim();
      }
      if (typeof val === "object" && val !== null && "text" in val) {
        return String((val as unknown as Record<string, unknown>).text || "").trim();
      }
      if (typeof val === "object" && val !== null && "result" in val) {
        return String((val as unknown as Record<string, unknown>).result || "").trim();
      }
      return String(val).trim();
    }

    const rows: Record<string, unknown>[] = [];
    const errors: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const stageNumberText = getCellText(row.getCell(1));
      const stageNumberRaw = row.getCell(1).value;
      const stageNameRaw = getCellText(row.getCell(2));
      const category = getCellText(row.getCell(3)) || null;
      const name = getCellText(row.getCell(4));
      const description = getCellText(row.getCell(5)) || null;
      const estimatedDaysText = getCellText(row.getCell(6));
      const estimatedDaysRaw = row.getCell(6).value;
      const consultantRaw = getCellText(row.getCell(7));
      const deliverable = getCellText(row.getCell(8)) || null;
      const phase = getCellText(row.getCell(9)) || null;

      if (!name) return;

      const stageNumber = typeof stageNumberRaw === "number" ? stageNumberRaw : parseInt(stageNumberText || String(stageNumberRaw));
      let stage = stageByNumber.get(stageNumber);
      if (!stage && stageNameRaw) {
        stage = stageByName.get(stageNameRaw.toLowerCase());
      }
      if (!stage) {
        errors.push(`Row ${rowNumber}: Stage "${stageNumberRaw || stageNameRaw}" not found`);
        return;
      }

      const estimatedDays = typeof estimatedDaysRaw === "number" ? estimatedDaysRaw : parseInt(estimatedDaysText || String(estimatedDaysRaw)) || 14;

      let consultantId: string | null = null;
      let consultantName: string | null = consultantRaw || null;
      if (consultantRaw) {
        const found = consultantByName.get(consultantRaw.toLowerCase());
        if (found) {
          consultantId = found.id;
          consultantName = found.name;
        }
      }

      rows.push({
        jobTypeId,
        companyId: companyId!,
        stageId: stage.id,
        category,
        name,
        description,
        estimatedDays,
        consultantId,
        consultantName,
        deliverable,
        jobPhase: phase,
        sortOrder: rowNumber - 1,
      });
    });

    if (rows.length === 0) {
      return res.status(400).json({
        error: "No valid activities found in the file",
        details: errors.length > 0 ? errors : undefined,
      });
    }

    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.insert(activityTemplates).values(row as typeof activityTemplates.$inferInsert);
      }
    });

    res.status(201).json({
      success: true,
      imported: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error importing activities");
    res.status(500).json({ error: "Failed to import activities" });
  }
});

export default router;
