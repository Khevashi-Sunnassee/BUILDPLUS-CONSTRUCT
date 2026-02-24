import { Router, Request, Response } from "express";
import { storage } from "../../storage";
import { requireRole } from "../middleware/auth.middleware";
import { logPanelChange } from "../../services/panel-audit.service";
import { panelImportSchema, buildPanelTypeMap } from "./shared";

const router = Router();

/**
 * Bulk panel import from spreadsheet data. Uses a two-pass strategy:
 * Pass 1 — validates every row (job resolution, panel mark, panel type lookup)
 * and accumulates errors. If ANY row fails, the entire import is rejected
 * (all-or-nothing) with up to 20 error details returned.
 * Pass 2 — maps validated rows to panel insert objects, normalizing field names
 * from multiple spreadsheet column naming conventions (camelCase, Title Case, snake_case).
 * Each field falls back through known aliases before defaulting to null.
 * A fallback jobId from the request body is used when rows omit a job number.
 */
router.post("/api/panels/admin/import", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const validationResult = panelImportSchema.safeParse(req.body);
    if (!validationResult.success) return res.status(400).json({ error: "Validation failed", details: validationResult.error.format() });
    const { data, jobId } = validationResult.data;
    
    const allJobs = await storage.getAllJobs(req.companyId);
    const jobsByNumber: Record<string, typeof allJobs[0]> = {};
    allJobs.forEach(job => {
      jobsByNumber[job.jobNumber.toLowerCase()] = job;
    });
    
    const panelTypeResult = await buildPanelTypeMap(req.companyId);
    if (!panelTypeResult) {
      return res.status(400).json({ 
        error: "No panel types configured in system. Please add panel types in Settings before importing." 
      });
    }
    const { panelTypesByNameOrCode, panelTypesList } = panelTypeResult;
    
    let fallbackJob = null;
    if (jobId) {
      fallbackJob = await storage.getJob(jobId);
    }
    
    const validatedRows: Array<{
      row: Record<string, unknown>;
      rowNumber: number;
      resolvedJob: Record<string, unknown> | null;
      panelType: string;
    }> = [];
    const errors: string[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;
      const rowErrors: string[] = [];
      
      const jobNumber = String(row.jobNumber || row["Job Number"] || row.job_number || row["Job"] || "").trim();
      
      let resolvedJob = null;
      if (jobNumber) {
        resolvedJob = jobsByNumber[jobNumber.toLowerCase()];
        if (!resolvedJob) {
          rowErrors.push(`Job "${jobNumber}" not found`);
        }
      } else if (fallbackJob) {
        resolvedJob = fallbackJob;
      } else {
        rowErrors.push(`No job specified and no fallback job selected`);
      }
      
      const panelMark = String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim();
      if (!panelMark) {
        rowErrors.push(`Missing panel mark`);
      }
      
      const typeRaw = String(row.panelType || row["Panel Type"] || row.panel_type || row["Type"] || "").toUpperCase().replace(/ /g, "_");
      let resolvedPanelType: string | undefined;
      if (!typeRaw) {
        rowErrors.push(`Missing panel type`);
      } else {
        resolvedPanelType = panelTypesByNameOrCode.get(typeRaw);
        if (!resolvedPanelType) {
          rowErrors.push(`Invalid panel type "${typeRaw}". Valid types are: ${panelTypesList}`);
        }
      }
      
      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
      } else if (resolvedJob && resolvedPanelType) {
        validatedRows.push({ row, rowNumber, resolvedJob, panelType: resolvedPanelType });
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: `Import failed: ${errors.length} row(s) have errors. No panels were imported.`,
        details: errors.slice(0, 20)
      });
    }
    
    if (validatedRows.length === 0) {
      return res.status(400).json({ 
        error: "No panels found in the file to import" 
      });
    }
    
    const panelsToImport = validatedRows.map(({ row, resolvedJob, panelType }) => {
      const widthRaw = row.width || row["Width"] || row["Width (mm)"] || row.loadWidth || row["Load Width"] || null;
      const heightRaw = row.height || row["Height"] || row["Height (mm)"] || row.loadHeight || row["Load Height"] || null;
      const thicknessRaw = row.thickness || row["Thickness"] || row["Thickness (mm)"] || row.panelThickness || row["Panel Thickness"] || null;
      const areaRaw = row.area || row["Area"] || row["Area (m²)"] || row["Area (m2)"] || row.panelArea || row["Panel Area"] || null;
      const volumeRaw = row.volume || row["Volume"] || row["Volume (m³)"] || row["Volume (m3)"] || row.panelVolume || row["Panel Volume"] || null;
      const weightRaw = row.weight || row["Weight"] || row["Weight (kg)"] || row.mass || row["Mass"] || row.panelMass || row["Panel Mass"] || null;
      const qtyRaw = row.qty || row["Qty"] || row.quantity || row["Quantity"] || 1;
      const panelMark = String(row.panelMark || row["Panel Mark"] || row.panel_mark || row["Mark"] || "").trim();
      
      return {
        jobId: resolvedJob!.id,
        panelMark,
        panelType,
        description: row.description || row["Description"] || null,
        drawingCode: row.drawingCode || row["Drawing Code"] || row.drawing_code || null,
        sheetNumber: row.sheetNumber || row["Sheet Number"] || row.sheet_number || null,
        building: row.building || row["Building"] || null,
        zone: row.zone || row["Zone"] || null,
        level: row.level || row["Level"] || null,
        structuralElevation: row.structuralElevation || row["Structural Elevation"] || row.structural_elevation || null,
        reckliDetail: row.reckliDetail || row["Reckli Detail"] || row.reckli_detail || null,
        qty: parseInt(String(qtyRaw)) || 1,
        loadWidth: widthRaw ? String(widthRaw) : null,
        loadHeight: heightRaw ? String(heightRaw) : null,
        panelThickness: thicknessRaw ? String(thicknessRaw) : null,
        panelArea: areaRaw ? String(areaRaw) : null,
        panelVolume: volumeRaw ? String(volumeRaw) : null,
        panelMass: weightRaw ? String(weightRaw) : null,
        concreteStrengthMpa: row.concreteStrength || row["Concrete Strength"] || row["Concrete Strength (MPa)"] || row.concreteStrengthMpa || null,
        takeoffCategory: row.takeoffCategory || row["Takeoff Category"] || row["TakeOff Category"] || null,
        source: 2,
        estimatedHours: row.estimatedHours || row["Estimated Hours"] || row.estimated_hours ? Number(row.estimatedHours || row["Estimated Hours"] || row.estimated_hours) : null,
        status: "NOT_STARTED" as const,
        numRebates: row.numRebates || row["Num Rebates"] ? parseInt(String(row.numRebates || row["Num Rebates"])) || null : null,
        fireRate: row.fireRate || row["Fire Rate"] || null,
        caulkingFire: row.caulkingFire || row["Caulking Fire"] || null,
        openings: row.openings || row["Openings"] || null,
        netWeight: row.netWeight || row["Net Weight"] || null,
        grossArea: row.grossArea || row["Gross Area"] || null,
        craneCapacityWeight: row.craneCapacityWeight || row["Crane Capacity Weight"] || null,
        craneCheck: row.craneCheck || row["Crane Check"] || null,
        groutTableManual: row.groutTableManual || row["Grout Table Manual"] || null,
        groutToUse: row.groutToUse || row["Grout To Use"] || null,
        groutStrength: row.groutStrength || row["Grout Strength"] || null,
        verticalReoQty: row.verticalReoQty || row["Vertical Reo Qty"] || null,
        verticalReoType: row.verticalReoType || row["Vertical Reo Type"] || null,
        horizontalReoQty: row.horizontalReoQty || row["Horizontal Reo Qty"] || null,
        horizontalReoType: row.horizontalReoType || row["Horizontal Reo Type"] || null,
        horizontalReoText: row.horizontalReoText || row["Horizontal Reo Text"] || null,
        horizontalReoAt: row.horizontalReoAt || row["Horizontal Reo At"] || null,
        meshQty: row.meshQty || row["Mesh Qty"] || null,
        meshType: row.meshType || row["Mesh Type"] || null,
        fitmentsReoQty: row.fitmentsReoQty || row["Fitments Reo Qty"] || null,
        fitmentsReoType: row.fitmentsReoType || row["Fitments Reo Type"] || null,
        uBarsQty: row.uBarsQty || row["U Bars Qty"] || null,
        uBarsType: row.uBarsType || row["U Bars Type"] || null,
        ligsQty: row.ligsQty || row["Ligs Qty"] || null,
        ligsType: row.ligsType || row["Ligs Type"] || null,
        blockoutBarsQty: row.blockoutBarsQty || row["Blockout Bars Qty"] || null,
        blockoutBarsType: row.blockoutBarsType || row["Blockout Bars Type"] || null,
        additionalReoQty1: row.additionalReoQty1 || row["Additional Reo Qty 1"] || null,
        additionalReoType1: row.additionalReoType1 || row["Additional Reo Type 1"] || null,
        additionalReoQty2: row.additionalReoQty2 || row["Additional Reo Qty 2"] || null,
        additionalReoType2: row.additionalReoType2 || row["Additional Reo Type 2"] || null,
        additionalReoQty3: row.additionalReoQty3 || row["Additional Reo Qty 3"] || null,
        additionalReoType3: row.additionalReoType3 || row["Additional Reo Type 3"] || null,
        additionalReoQty4: row.additionalReoQty4 || row["Additional Reo Qty 4"] || null,
        additionalReoType4: row.additionalReoType4 || row["Additional Reo Type 4"] || null,
        topFixingQty: row.topFixingQty || row["Top Fixing Qty"] || null,
        topFixingType: row.topFixingType || row["Top Fixing Type"] || null,
        trimmerBarsQty: row.trimmerBarsQty || row["Trimmer Bars Qty"] || null,
        trimmerBarsType: row.trimmerBarsType || row["Trimmer Bars Type"] || null,
        ligsReoQty: row.ligsReoQty || row["Ligs Reo Qty"] || null,
        ligsReoType: row.ligsReoType || row["Ligs Reo Type"] || null,
        additionalReoType: row.additionalReoType || row["Additional Reo Type"] || null,
        additionalReoQty: row.additionalReoQty || row["Additional Reo Qty"] || null,
        additionalReoFrlType: row.additionalReoFrlType || row["Additional Reo FRL Type"] || null,
        tieReinforcement: row.tieReinforcement || row["Tie Reinforcement"] || null,
        groutTubesBottomQty: row.groutTubesBottomQty || row["Grout Tubes Bottom Qty"] || null,
        groutTubesBottomType: row.groutTubesBottomType || row["Grout Tubes Bottom Type"] || null,
        groutTubesTopQty: row.groutTubesTopQty || row["Grout Tubes Top Qty"] || null,
        groutTubesTopType: row.groutTubesTopType || row["Grout Tubes Top Type"] || null,
        ferrulesQty: row.ferrulesQty || row["Ferrules Qty"] || null,
        ferrulesType: row.ferrulesType || row["Ferrules Type"] || null,
        fitmentsQty2: row.fitmentsQty2 || row["Fitments Qty 2"] || null,
        fitmentsType2: row.fitmentsType2 || row["Fitments Type 2"] || null,
        fitmentsQty3: row.fitmentsQty3 || row["Fitments Qty 3"] || null,
        fitmentsType3: row.fitmentsType3 || row["Fitments Type 3"] || null,
        fitmentsQty4: row.fitmentsQty4 || row["Fitments Qty 4"] || null,
        fitmentsType4: row.fitmentsType4 || row["Fitments Type 4"] || null,
        platesQty: row.platesQty || row["Plates Qty"] || null,
        platesType: row.platesType || row["Plates Type"] || null,
        platesQty2: row.platesQty2 || row["Plates Qty 2"] || null,
        platesType2: row.platesType2 || row["Plates Type 2"] || null,
        platesQty3: row.platesQty3 || row["Plates Qty 3"] || null,
        platesType3: row.platesType3 || row["Plates Type 3"] || null,
        platesQty4: row.platesQty4 || row["Plates Qty 4"] || null,
        platesType4: row.platesType4 || row["Plates Type 4"] || null,
        dowelBarsLength: row.dowelBarsLength || row["Dowel Bars Length"] || null,
        dowelBarsQty: row.dowelBarsQty || row["Dowel Bars Qty"] || null,
        dowelBarsType: row.dowelBarsType || row["Dowel Bars Type"] || null,
        dowelBarsLength2: row.dowelBarsLength2 || row["Dowel Bars Length 2"] || null,
        dowelBarsQty2: row.dowelBarsQty2 || row["Dowel Bars Qty 2"] || null,
        dowelBarsType2: row.dowelBarsType2 || row["Dowel Bars Type 2"] || null,
        lifterQtyA: row.lifterQtyA || row["Lifter Qty A"] || null,
        liftersType: row.liftersType || row["Lifters Type"] || null,
        lifterQtyB: row.lifterQtyB || row["Lifter Qty B"] || null,
        safetyLiftersType: row.safetyLiftersType || row["Safety Lifters Type"] || null,
        lifterQtyC: row.lifterQtyC || row["Lifter Qty C"] || null,
        faceLiftersType: row.faceLiftersType || row["Face Lifters Type"] || null,
        insertsQtyD: row.insertsQtyD || row["Inserts Qty D"] || null,
        insertTypeD: row.insertTypeD || row["Insert Type D"] || null,
        unitCheck: row.unitCheck || row["Unit Check"] || null,
        order: row.order || row["Order"] || null,
        reoR6: row.reoR6 || row["Reo R6"] || null,
        reoN10: row.reoN10 || row["Reo N10"] || null,
        reoN12: row.reoN12 || row["Reo N12"] || null,
        reoN16: row.reoN16 || row["Reo N16"] || null,
        reoN20: row.reoN20 || row["Reo N20"] || null,
        reoN24: row.reoN24 || row["Reo N24"] || null,
        reoN28: row.reoN28 || row["Reo N28"] || null,
        reoN32: row.reoN32 || row["Reo N32"] || null,
        meshSl82: row.meshSl82 || row["Mesh SL82"] || null,
        meshSl92: row.meshSl92 || row["Mesh SL92"] || null,
        meshSl102: row.meshSl102 || row["Mesh SL102"] || null,
        dowelN20: row.dowelN20 || row["Dowel N20"] || null,
        dowelN24: row.dowelN24 || row["Dowel N24"] || null,
        dowelN28: row.dowelN28 || row["Dowel N28"] || null,
        dowelN32: row.dowelN32 || row["Dowel N32"] || null,
        dowelN36: row.dowelN36 || row["Dowel N36"] || null,
        reoTons: row.reoTons || row["Reo Tons"] || null,
        dowelsTons: row.dowelsTons || row["Dowels Tons"] || null,
        totalReo: row.totalReo || row["Total Reo"] || null,
        totalKgM3: row.totalKgM3 || row["Total Kg M3"] || null,
        contract: row.contract || row["Contract"] || null,
        reoContract: row.reoContract || row["Reo Contract"] || null,
      };
    });
    
    const result = await storage.importPanelRegister(panelsToImport);
    for (const panelId of result.importedIds) {
      logPanelChange(panelId, "Panel imported from estimate", req.session.userId, { changedFields: { source: "estimate_import" }, newLifecycleStatus: 0 });
    }
    res.json(result);
  } catch (error: unknown) {
    res.status(400).json({ error: "An internal error occurred" });
  }
});

export default router;
