import { Router, Request, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { storage, sha256Hex } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { logPanelChange } from "../services/panel-audit.service";
import { PANEL_LIFECYCLE_STATUS } from "@shared/schema";
import { z } from "zod";

const router = Router();

const panelImportSchema = z.object({
  data: z.array(z.record(z.any())),
  jobId: z.string().optional(),
});

const estimateImportBodySchema = z.object({
  replace: z.string().optional(),
});

const ALLOWED_IMPORT_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMPORT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Only Excel and CSV files are accepted.`));
    }
  },
});

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
    
    const panelTypeConfigs = await storage.getAllPanelTypes(req.companyId);
    if (panelTypeConfigs.length === 0) {
      return res.status(400).json({ 
        error: "No panel types configured in system. Please add panel types in Settings before importing." 
      });
    }
    const panelTypesByNameOrCode = new Map<string, string>();
    panelTypeConfigs.forEach(pt => {
      const normalizedName = pt.name.toUpperCase().replace(/ /g, "_");
      const normalizedCode = pt.code.toUpperCase().replace(/ /g, "_");
      panelTypesByNameOrCode.set(normalizedName, pt.code);
      panelTypesByNameOrCode.set(normalizedCode, pt.code);
    });
    const panelTypesList = panelTypeConfigs.map(pt => `${pt.name} (${pt.code})`).join(", ");
    
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
        // New detailed fields - all from row data
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
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

router.post("/api/jobs/:jobId/import-estimate", 
  requireAuth, 
  requireRole("ADMIN", "MANAGER"),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const bodyResult = estimateImportBodySchema.safeParse(req.body);
      if (!bodyResult.success) return res.status(400).json({ error: "Validation failed", details: bodyResult.error.format() });
      const { jobId } = req.params;
      const replace = bodyResult.data.replace === "true";
      
      const job = await storage.getJob(String(jobId));
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileName = req.file.originalname;
      const fileBuffer = req.file.buffer;
      const fileHash = sha256Hex(fileBuffer);
      
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);
      
      const takeoffSheets = workbook.worksheets
        .map(ws => ws.name)
        .filter(name => {
          const normalized = name.toLowerCase().replace(/[\s\-]/g, "");
          return normalized.includes("takeoff");
        });
      
      if (takeoffSheets.length === 0) {
        return res.status(400).json({ error: "No TakeOff sheets found in the workbook" });
      }
      
      if (replace) {
        await storage.deletePanelsByJobAndSource(String(jobId), 3);
      }
      
      const panelTypeConfigs = await storage.getAllPanelTypes(req.companyId);
      if (panelTypeConfigs.length === 0) {
        return res.status(400).json({ 
          error: "No panel types configured in system. Please add panel types in Settings before importing." 
        });
      }
      const panelTypesByNameOrCode = new Map<string, string>();
      panelTypeConfigs.forEach(pt => {
        const normalizedName = pt.name.toUpperCase().replace(/ /g, "_");
        const normalizedCode = pt.code.toUpperCase().replace(/ /g, "_");
        panelTypesByNameOrCode.set(normalizedName, pt.code);
        panelTypesByNameOrCode.set(normalizedCode, pt.code);
      });
      const panelTypesList = panelTypeConfigs.map(pt => `${pt.name} (${pt.code})`).join(", ");
      
      const results: { sheetName: string; takeoffCategory?: string; created: number; duplicates: number; skipped: number; errors: string[] }[] = [];
      const panelsToImport: Record<string, unknown>[] = [];
      const existingPanelSourceIds = await storage.getExistingPanelSourceIds(String(jobId));
      
      const headerMapping: Record<string, string> = {
        // Basic panel identification
        "column": "panelMark", "column no": "panelMark", "columnno": "panelMark",
        "panelmark": "panelMark", "panel mark": "panelMark", "mark": "panelMark", "element": "panelMark",
        "building": "building", "zone": "zone",
        "structural elevation number": "structuralElevation", "structural elevation no": "structuralElevation",
        "structuralelevation": "structuralElevation", "structuralelevationno": "structuralElevation",
        "level": "level",
        "column type": "panelType", "columntype": "panelType", "paneltype": "panelType", "panel type": "panelType", "type": "panelType",
        "reckli detail": "reckliDetail", "recklidetail": "reckliDetail",
        // Dimensions
        "thickness": "thickness", "width": "width", "height": "height",
        "gross area m2": "areaM2", "grossaream2": "areaM2",
        "net area m2": "areaM2", "net area": "areaM2", "netaream2": "areaM2", "area": "areaM2",
        // Concrete
        "concrete strength mpa": "concreteStrength", "concrete strength": "concreteStrength",
        "concretestrength": "concreteStrength", "concretestrengthmpa": "concreteStrength",
        "vol m3": "volumeM3", "vol": "volumeM3", "volm3": "volumeM3", "volume": "volumeM3",
        "weight t": "weightT", "weight": "weightT", "weightt": "weightT", "mass": "weightT",
        "colum qty": "qty", "columqty": "qty", "qty": "qty", "quantity": "qty",
        "rebates": "rebates", "num rebates": "rebates",
        // Fire rating
        "fire rate": "fireRate", "firerate": "fireRate", "frl": "fireRate",
        "caulking fire": "caulkingFire", "caulkingfire": "caulkingFire",
        // Openings and weight
        "openings": "openings",
        "net weight": "netWeight", "netweight": "netWeight",
        "gross area": "grossArea", "grossarea": "grossArea",
        "crane capacity weight": "craneCapacityWeight", "cranecapacityweight": "craneCapacityWeight",
        "crane check": "craneCheck", "cranecheck": "craneCheck",
        // Grout
        "grout table manual": "groutTableManual", "grouttablemanual": "groutTableManual",
        "grout to use": "groutToUse", "grouttouse": "groutToUse",
        "grout strength": "groutStrength", "groutstrength": "groutStrength",
        // Vertical Reo
        "vertical reo qty": "verticalReoQty", "verticalreoqty": "verticalReoQty",
        "vertical reo type": "verticalReoType", "verticalreotype": "verticalReoType",
        // Horizontal Reo
        "horizontal reo qty": "horizontalReoQty", "horizontalreoqty": "horizontalReoQty",
        "horizontal reo type": "horizontalReoType", "horizontalreotype": "horizontalReoType",
        "horizontal reo text": "horizontalReoText", "horizontalreotext": "horizontalReoText",
        "horizontal reo at": "horizontalReoAt", "horizontalreoat": "horizontalReoAt",
        // Mesh
        "mesh qty": "meshQty", "meshqty": "meshQty",
        "mesh type": "meshType", "meshtype": "meshType",
        // Fitments Reo
        "fitments reo qty": "fitmentsReoQty", "fitmentsreoqty": "fitmentsReoQty",
        "fitments reo type": "fitmentsReoType", "fitmentsreotype": "fitmentsReoType",
        // U bars
        "u bars qty": "uBarsQty", "ubarsqty": "uBarsQty", "u bar qty": "uBarsQty",
        "u bars type": "uBarsType", "ubarstype": "uBarsType", "u bar type": "uBarsType",
        // Ligs
        "ligs qty": "ligsQty", "ligsqty": "ligsQty",
        "ligs type": "ligsType", "ligstype": "ligsType",
        // Blockout bars
        "blockout bars qty": "blockoutBarsQty", "blockoutbarsqty": "blockoutBarsQty",
        "blockout bars type": "blockoutBarsType", "blockoutbarstype": "blockoutBarsType",
        // Additional reo sets
        "additional reo qty 1": "additionalReoQty1", "additionalreoqty1": "additionalReoQty1",
        "additional reo type 1": "additionalReoType1", "additionalreotype1": "additionalReoType1",
        "additional reo qty 2": "additionalReoQty2", "additionalreoqty2": "additionalReoQty2",
        "additional reo type 2": "additionalReoType2", "additionalreotype2": "additionalReoType2",
        "additional reo qty 3": "additionalReoQty3", "additionalreoqty3": "additionalReoQty3",
        "additional reo type 3": "additionalReoType3", "additionalreotype3": "additionalReoType3",
        "additional reo qty 4": "additionalReoQty4", "additionalreoqty4": "additionalReoQty4",
        "additional reo type 4": "additionalReoType4", "additionalreotype4": "additionalReoType4",
        // Top Fixing
        "top fixing qty": "topFixingQty", "topfixingqty": "topFixingQty",
        "top fixing type": "topFixingType", "topfixingtype": "topFixingType",
        // Trimmer bars
        "trimmer bars qty": "trimmerBarsQty", "trimmerbarsqty": "trimmerBarsQty",
        "trimmer bars type": "trimmerBarsType", "trimmerbarstype": "trimmerBarsType",
        // Ligs Reo
        "ligs reo qty": "ligsReoQty", "ligsreoqty": "ligsReoQty",
        "ligs reo type": "ligsReoType", "ligsreotype": "ligsReoType",
        // General additional reo
        "additional reo type": "additionalReoType", "additionalreotype": "additionalReoType",
        "additional reo qty": "additionalReoQty", "additionalreoqty": "additionalReoQty",
        "additional reo frl type": "additionalReoFrlType", "additionalreofrltype": "additionalReoFrlType",
        // Tie reinforcement
        "tie reinforcement": "tieReinforcement", "tiereinforcement": "tieReinforcement",
        // Grout Tubes
        "grout tubes bottom qty": "groutTubesBottomQty", "grouttubsbottomqty": "groutTubesBottomQty",
        "grout tubes bottom type": "groutTubesBottomType", "grouttubsbottomtype": "groutTubesBottomType",
        "grout tubes top qty": "groutTubesTopQty", "grouttubstopqty": "groutTubesTopQty",
        "grout tubes top type": "groutTubesTopType", "grouttubstoptype": "groutTubesTopType",
        // Ferrules and Fitments
        "ferrules qty": "ferrulesQty", "ferrulesqty": "ferrulesQty",
        "ferrules type": "ferrulesType", "ferrulestype": "ferrulesType",
        "fitments qty 2": "fitmentsQty2", "fitmentsqty2": "fitmentsQty2",
        "fitments type 2": "fitmentsType2", "fitmentstype2": "fitmentsType2",
        "fitments qty 3": "fitmentsQty3", "fitmentsqty3": "fitmentsQty3",
        "fitments type 3": "fitmentsType3", "fitmentstype3": "fitmentsType3",
        "fitments qty 4": "fitmentsQty4", "fitmentsqty4": "fitmentsQty4",
        "fitments type 4": "fitmentsType4", "fitmentstype4": "fitmentsType4",
        // Plates
        "plates qty": "platesQty", "platesqty": "platesQty",
        "plates type": "platesType", "platestype": "platesType",
        "plates qty 2": "platesQty2", "platesqty2": "platesQty2",
        "plates type 2": "platesType2", "platestype2": "platesType2",
        "plates qty 3": "platesQty3", "platesqty3": "platesQty3",
        "plates type 3": "platesType3", "platestype3": "platesType3",
        "plates qty 4": "platesQty4", "platesqty4": "platesQty4",
        "plates type 4": "platesType4", "platestype4": "platesType4",
        // Dowel bars TYPICAL
        "dowel bars length": "dowelBarsLength", "dowelbarslength": "dowelBarsLength",
        "dowel bars qty": "dowelBarsQty", "dowelbarsqty": "dowelBarsQty",
        "dowel bars type": "dowelBarsType", "dowelbarstype": "dowelBarsType",
        // Dowel bars END
        "dowel bars length 2": "dowelBarsLength2", "dowelbarslength2": "dowelBarsLength2",
        "dowel bars qty 2": "dowelBarsQty2", "dowelbarsqty2": "dowelBarsQty2",
        "dowel bars type 2": "dowelBarsType2", "dowelbarstype2": "dowelBarsType2",
        // Lifters
        "lifter qty a": "lifterQtyA", "lifterqtya": "lifterQtyA",
        "lifters type": "liftersType", "lifterstype": "liftersType",
        "lifter qty b": "lifterQtyB", "lifterqtyb": "lifterQtyB",
        "safety lifters type": "safetyLiftersType", "safetylifterstype": "safetyLiftersType",
        "lifter qty c": "lifterQtyC", "lifterqtyc": "lifterQtyC",
        "face lifters type": "faceLiftersType", "facelifterstype": "faceLiftersType",
        // Other Inserts
        "inserts qty d": "insertsQtyD", "insertsqtyd": "insertsQtyD",
        "insert type d": "insertTypeD", "inserttyped": "insertTypeD",
        "unit check": "unitCheck", "unitcheck": "unitCheck",
        "order": "order",
        // Reo bar counts
        "reo r6": "reoR6", "reor6": "reoR6", "r6": "reoR6",
        "reo n10": "reoN10", "reon10": "reoN10", "n10": "reoN10",
        "reo n12": "reoN12", "reon12": "reoN12", "n12": "reoN12",
        "reo n16": "reoN16", "reon16": "reoN16", "n16": "reoN16",
        "reo n20": "reoN20", "reon20": "reoN20", "n20": "reoN20",
        "reo n24": "reoN24", "reon24": "reoN24", "n24": "reoN24",
        "reo n28": "reoN28", "reon28": "reoN28", "n28": "reoN28",
        "reo n32": "reoN32", "reon32": "reoN32", "n32": "reoN32",
        // Mesh counts
        "mesh sl82": "meshSl82", "meshsl82": "meshSl82", "sl82": "meshSl82",
        "mesh sl92": "meshSl92", "meshsl92": "meshSl92", "sl92": "meshSl92",
        "mesh sl102": "meshSl102", "meshsl102": "meshSl102", "sl102": "meshSl102",
        // Dowel counts
        "dowel n20": "dowelN20", "doweln20": "dowelN20",
        "dowel n24": "dowelN24", "doweln24": "dowelN24",
        "dowel n28": "dowelN28", "doweln28": "dowelN28",
        "dowel n32": "dowelN32", "doweln32": "dowelN32",
        "dowel n36": "dowelN36", "doweln36": "dowelN36",
        // Totals
        "reo tons": "reoTons", "reotons": "reoTons",
        "dowels tons": "dowelsTons", "dowelstons": "dowelsTons",
        "total reo": "totalReo", "totalreo": "totalReo",
        "total kg m3": "totalKgM3", "totalkgm3": "totalKgM3",
        "contract": "contract",
        "reo contract": "reoContract", "reocontract": "reoContract",
      };
      
      for (const sheetName of takeoffSheets) {
        const sheetResult = {
          sheetName, takeoffCategory: "", headerRow: -1,
          created: 0, duplicates: 0, skipped: 0, errors: [] as string[],
        };
        
        let category = sheetName.replace(/takeoff/gi, "").replace(/take off/gi, "").replace(/take-off/gi, "").trim();
        if (!category) category = "Uncategorised";
        sheetResult.takeoffCategory = category;
        
        const sheet = workbook.getWorksheet(sheetName)!;
        const data: unknown[][] = [];
        sheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
          const rowValues = row.values as unknown[];
          data.push(rowValues.slice(1));
        });
        
        let headerRow = -1;
        let headers: string[] = [];
        const requiredHeaders = ["column", "level", "thickness", "width", "height", "vol", "weight"];
        
        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i];
          if (!row || row.length < 5) continue;
          
          const normalizedCells = row.map((cell) => 
            String(cell || "").toLowerCase().replace(/[()#²³]/g, "").trim()
          );
          
          let matches = 0;
          for (const required of requiredHeaders) {
            if (normalizedCells.some(c => c.includes(required))) matches++;
          }
          
          if (matches >= 4) {
            headerRow = i;
            headers = normalizedCells;
            break;
          }
        }
        
        if (headerRow === -1) {
          sheetResult.errors.push("Could not find header row - sheet may have different column structure");
          results.push(sheetResult);
          continue;
        }
        
        sheetResult.headerRow = headerRow + 1;
        
        const colMapping: Record<number, string> = {};
        const priorityPatterns = [
          // Core panel identification
          { patterns: ["column no", "columnno", "panel mark", "panelmark", "element", "mark", "column"], field: "panelMark" },
          { patterns: ["column type", "columntype", "panel type", "paneltype"], field: "panelType" },
          { patterns: ["structural elevation no", "structural elevation number", "structuralelevationno", "structuralelevation"], field: "structuralElevation" },
          { patterns: ["building"], field: "building" },
          { patterns: ["zone"], field: "zone" },
          { patterns: ["level"], field: "level" },
          { patterns: ["type"], field: "panelType" },
          { patterns: ["reckli detail", "recklidetail"], field: "reckliDetail" },
          // Dimensions
          { patterns: ["thickness"], field: "thickness" },
          { patterns: ["width"], field: "width" },
          { patterns: ["height"], field: "height" },
          { patterns: ["gross area", "net area", "area"], field: "areaM2" },
          { patterns: ["concrete strength", "concretestrength"], field: "concreteStrength" },
          { patterns: ["vol", "volume"], field: "volumeM3" },
          { patterns: ["weight", "mass"], field: "weightT" },
          { patterns: ["colum qty", "columqty", "qty", "quantity"], field: "qty" },
          { patterns: ["rebates", "num rebates"], field: "rebates" },
          // Fire rating
          { patterns: ["fire rate", "firerate", "frl"], field: "fireRate" },
          { patterns: ["caulking fire", "caulkingfire"], field: "caulkingFire" },
          // Openings and weight
          { patterns: ["openings"], field: "openings" },
          { patterns: ["net weight", "netweight"], field: "netWeight" },
          { patterns: ["panel gross area", "gross area sqm", "grossarea"], field: "grossArea" },
          { patterns: ["crane capacity weight", "cranecapacityweight"], field: "craneCapacityWeight" },
          { patterns: ["crane check", "cranecheck"], field: "craneCheck" },
          // Grout
          { patterns: ["grout table manual", "grouttablemanual"], field: "groutTableManual" },
          { patterns: ["grout to use", "grouttouse"], field: "groutToUse" },
          { patterns: ["grout strength", "groutstrength"], field: "groutStrength" },
          // Vertical Reo
          { patterns: ["vertical reo qty", "verticalreoqty"], field: "verticalReoQty" },
          { patterns: ["vertical reo type", "verticalreotype"], field: "verticalReoType" },
          // Horizontal Reo
          { patterns: ["horizontal reo qty", "horizontalreoqty"], field: "horizontalReoQty" },
          { patterns: ["horizontal reo type", "horizontalreotype"], field: "horizontalReoType" },
          { patterns: ["horizontal reo text", "horizontalreotext"], field: "horizontalReoText" },
          { patterns: ["horizontal reo at", "horizontalreoat"], field: "horizontalReoAt" },
          // Mesh
          { patterns: ["mesh qty", "meshqty"], field: "meshQty" },
          { patterns: ["mesh type", "meshtype"], field: "meshType" },
          // Fitments Reo
          { patterns: ["fitments reo qty", "fitmentsreoqty"], field: "fitmentsReoQty" },
          { patterns: ["fitments reo type", "fitmentsreotype"], field: "fitmentsReoType" },
          // U bars
          { patterns: ["u bars qty", "ubarsqty", "u bar qty"], field: "uBarsQty" },
          { patterns: ["u bars type", "ubarstype", "u bar type"], field: "uBarsType" },
          // Ligs
          { patterns: ["ligs qty", "ligsqty"], field: "ligsQty" },
          { patterns: ["ligs type", "ligstype"], field: "ligsType" },
          // Blockout bars
          { patterns: ["blockout bars qty", "blockoutbarsqty"], field: "blockoutBarsQty" },
          { patterns: ["blockout bars type", "blockoutbarstype"], field: "blockoutBarsType" },
          // Top Fixing
          { patterns: ["top fixing qty", "topfixingqty"], field: "topFixingQty" },
          { patterns: ["top fixing type", "topfixingtype"], field: "topFixingType" },
          // Trimmer bars
          { patterns: ["trimmer bars qty", "trimmerbarsqty"], field: "trimmerBarsQty" },
          { patterns: ["trimmer bars type", "trimmerbarstype"], field: "trimmerBarsType" },
          // Grout Tubes
          { patterns: ["grout tubes bottom qty", "grouttubsbottomqty"], field: "groutTubesBottomQty" },
          { patterns: ["grout tubes bottom type", "grouttubsbottomtype"], field: "groutTubesBottomType" },
          { patterns: ["grout tubes top qty", "grouttubstopqty"], field: "groutTubesTopQty" },
          { patterns: ["grout tubes top type", "grouttubstoptype"], field: "groutTubesTopType" },
          // Ferrules
          { patterns: ["ferrules qty", "ferrulesqty"], field: "ferrulesQty" },
          { patterns: ["ferrules type", "ferrulestype"], field: "ferrulesType" },
          // Plates
          { patterns: ["plates qty", "platesqty"], field: "platesQty" },
          { patterns: ["plates type", "platestype"], field: "platesType" },
          // Dowel bars
          { patterns: ["dowel bars length", "dowelbarslength"], field: "dowelBarsLength" },
          { patterns: ["dowel bars qty", "dowelbarsqty"], field: "dowelBarsQty" },
          { patterns: ["dowel bars type", "dowelbarstype"], field: "dowelBarsType" },
          // Lifters
          { patterns: ["lifter qty a", "lifterqtya"], field: "lifterQtyA" },
          { patterns: ["lifters type", "lifterstype"], field: "liftersType" },
          { patterns: ["lifter qty b", "lifterqtyb"], field: "lifterQtyB" },
          { patterns: ["safety lifters type", "safetylifterstype"], field: "safetyLiftersType" },
          { patterns: ["lifter qty c", "lifterqtyc"], field: "lifterQtyC" },
          { patterns: ["face lifters type", "facelifterstype"], field: "faceLiftersType" },
          // Other Inserts
          { patterns: ["inserts qty d", "insertsqtyd"], field: "insertsQtyD" },
          { patterns: ["insert type d", "inserttyped"], field: "insertTypeD" },
          { patterns: ["unit check", "unitcheck"], field: "unitCheck" },
          { patterns: ["order"], field: "order" },
          // Reo bar counts
          { patterns: ["r6"], field: "reoR6" },
          { patterns: ["n10"], field: "reoN10" },
          { patterns: ["n12"], field: "reoN12" },
          { patterns: ["n16"], field: "reoN16" },
          { patterns: ["n20"], field: "reoN20" },
          { patterns: ["n24"], field: "reoN24" },
          { patterns: ["n28"], field: "reoN28" },
          { patterns: ["n32"], field: "reoN32" },
          // Mesh counts
          { patterns: ["sl82"], field: "meshSl82" },
          { patterns: ["sl92"], field: "meshSl92" },
          { patterns: ["sl102"], field: "meshSl102" },
          // Totals
          { patterns: ["reo tons", "reotons"], field: "reoTons" },
          { patterns: ["dowels tons", "dowelstons"], field: "dowelsTons" },
          { patterns: ["total reo", "totalreo"], field: "totalReo" },
          { patterns: ["total kg m3", "totalkgm3"], field: "totalKgM3" },
          { patterns: ["contract"], field: "contract" },
          { patterns: ["reo contract", "reocontract"], field: "reoContract" },
        ];
        
        headers.forEach((header, idx) => {
          if (colMapping[idx]) return;
          const normalizedHeader = header.replace(/\s+/g, " ").toLowerCase().trim();
          if (!normalizedHeader) return;
          
          for (const { patterns, field } of priorityPatterns) {
            if (Object.values(colMapping).includes(field)) continue;
            
            for (const pattern of patterns) {
              if (normalizedHeader === pattern || normalizedHeader.includes(pattern)) {
                colMapping[idx] = field;
                break;
              }
            }
            if (colMapping[idx]) break;
          }
        });
        
        const mappedFields = Object.values(colMapping);
        
        if (!mappedFields.includes("panelMark")) {
          sheetResult.errors.push(`Missing required column: Column # / Panel Mark. Detected headers: ${headers.slice(0, 10).join(", ")}`);
          results.push(sheetResult);
          continue;
        }
        if (!mappedFields.includes("level") && !mappedFields.includes("thickness")) {
          sheetResult.errors.push("Missing required columns: Level or Thickness");
          results.push(sheetResult);
          continue;
        }
        
        const panelMarkColIdx = Object.entries(colMapping).find(([_, v]) => v === "panelMark")?.[0];
        
        for (let i = headerRow + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const panelMark = String(row[Number(panelMarkColIdx)] || "").trim();
          
          const firstCell = String(row[0] || "").toLowerCase();
          if (["total", "subtotal", "summary"].some(t => firstCell.includes(t))) continue;
          
          const nonEmptyCells = row.filter((c) => c !== null && c !== undefined && c !== "").length;
          if (!panelMark && nonEmptyCells < 3) continue;
          
          if (!panelMark) {
            sheetResult.skipped++;
            continue;
          }
          
          const rowData: Record<string, unknown> = {};
          Object.entries(colMapping).forEach(([colIdx, field]) => {
            rowData[field] = row[Number(colIdx)];
          });
          
          const thickness = parseFloat(String(rowData.thickness)) || null;
          const width = parseFloat(String(rowData.width)) || null;
          const height = parseFloat(String(rowData.height)) || null;
          const areaM2 = parseFloat(String(rowData.areaM2)) || null;
          const volumeM3 = parseFloat(String(rowData.volumeM3)) || null;
          const weightT = parseFloat(String(rowData.weightT)) || null;
          const qty = parseInt(String(rowData.qty)) || 1;
          const concreteStrength = String(rowData.concreteStrength || "");
          
          const thicknessMm = thickness ? (thickness < 1 ? thickness * 1000 : thickness) : null;
          const widthMm = width ? (width < 10 ? width * 1000 : width) : null;
          const heightMm = height ? (height < 10 ? height * 1000 : height) : null;
          const weightKg = weightT ? weightT * 1000 : null;
          
          const sourceRowNum = i + 1;
          const panelSourceId = sha256Hex(
            `${jobId}-${fileHash}-${sheetName}-${sourceRowNum}-${panelMark}-${rowData.structuralElevation || ""}`
          );
          
          if (existingPanelSourceIds.has(panelSourceId)) {
            sheetResult.duplicates++;
            continue;
          }
          
          const typeRaw = String(rowData.panelType || category || "").toUpperCase().replace(/\s+/g, "_");
          let panelType: string | undefined;
          
          if (panelTypesByNameOrCode.has(typeRaw)) {
            panelType = panelTypesByNameOrCode.get(typeRaw);
          } else {
            const matchedKey = Array.from(panelTypesByNameOrCode.keys()).find(key => 
              typeRaw.includes(key) || key.includes(typeRaw)
            );
            if (matchedKey) {
              panelType = panelTypesByNameOrCode.get(matchedKey);
            } else {
              sheetResult.errors.push(`Row ${sourceRowNum}: Invalid panel type "${typeRaw}". Valid types are: ${panelTypesList}`);
              continue;
            }
          }
          
          const buildingValue = rowData.building ? String(rowData.building) : (rowData.zone ? "" : "1");
          
          const rawLevel = String(rowData.level || "").trim();
          let normalizedLevel = rawLevel;
          
          const rangeMatch = rawLevel.match(/^(\d+|L\d+|Ground)-?(L?\d+|Roof)?$/i);
          if (rangeMatch && rangeMatch[2]) {
            normalizedLevel = rangeMatch[1];
          }
          normalizedLevel = normalizedLevel.replace(/^L/i, "");
          
          panelsToImport.push({
            jobId, panelMark, panelType,
            building: buildingValue,
            zone: String(rowData.zone || ""),
            level: normalizedLevel,
            structuralElevation: String(rowData.structuralElevation || ""),
            reckliDetail: String(rowData.reckliDetail || ""),
            qty, takeoffCategory: category, concreteStrengthMpa: concreteStrength,
            panelThickness: thicknessMm ? String(thicknessMm) : null,
            loadWidth: widthMm ? String(widthMm) : null,
            loadHeight: heightMm ? String(heightMm) : null,
            panelArea: areaM2 ? String(areaM2) : null,
            panelVolume: volumeM3 ? String(volumeM3) : null,
            panelMass: weightKg ? String(weightKg) : null,
            sourceFileName: fileName, sourceSheet: sheetName,
            sourceRow: sourceRowNum, panelSourceId,
            source: 3, status: "PENDING" as const,
            // New detailed fields
            numRebates: rowData.rebates ? parseInt(String(rowData.rebates)) || null : null,
            fireRate: rowData.fireRate || null,
            caulkingFire: rowData.caulkingFire || null,
            openings: rowData.openings || null,
            netWeight: rowData.netWeight || null,
            grossArea: rowData.grossArea || null,
            craneCapacityWeight: rowData.craneCapacityWeight || null,
            craneCheck: rowData.craneCheck || null,
            // Grout
            groutTableManual: rowData.groutTableManual || null,
            groutToUse: rowData.groutToUse || null,
            groutStrength: rowData.groutStrength || null,
            // Reo types
            verticalReoQty: rowData.verticalReoQty || null,
            verticalReoType: rowData.verticalReoType || null,
            horizontalReoQty: rowData.horizontalReoQty || null,
            horizontalReoType: rowData.horizontalReoType || null,
            horizontalReoText: rowData.horizontalReoText || null,
            horizontalReoAt: rowData.horizontalReoAt || null,
            meshQty: rowData.meshQty || null,
            meshType: rowData.meshType || null,
            fitmentsReoQty: rowData.fitmentsReoQty || null,
            fitmentsReoType: rowData.fitmentsReoType || null,
            uBarsQty: rowData.uBarsQty || null,
            uBarsType: rowData.uBarsType || null,
            ligsQty: rowData.ligsQty || null,
            ligsType: rowData.ligsType || null,
            blockoutBarsQty: rowData.blockoutBarsQty || null,
            blockoutBarsType: rowData.blockoutBarsType || null,
            // Additional reo sets
            additionalReoQty1: rowData.additionalReoQty1 || null,
            additionalReoType1: rowData.additionalReoType1 || null,
            additionalReoQty2: rowData.additionalReoQty2 || null,
            additionalReoType2: rowData.additionalReoType2 || null,
            additionalReoQty3: rowData.additionalReoQty3 || null,
            additionalReoType3: rowData.additionalReoType3 || null,
            additionalReoQty4: rowData.additionalReoQty4 || null,
            additionalReoType4: rowData.additionalReoType4 || null,
            // Top Fixing & Trimmer bars
            topFixingQty: rowData.topFixingQty || null,
            topFixingType: rowData.topFixingType || null,
            trimmerBarsQty: rowData.trimmerBarsQty || null,
            trimmerBarsType: rowData.trimmerBarsType || null,
            // Ligs Reo & Additional
            ligsReoQty: rowData.ligsReoQty || null,
            ligsReoType: rowData.ligsReoType || null,
            additionalReoType: rowData.additionalReoType || null,
            additionalReoQty: rowData.additionalReoQty || null,
            additionalReoFrlType: rowData.additionalReoFrlType || null,
            tieReinforcement: rowData.tieReinforcement || null,
            // Grout Tubes
            groutTubesBottomQty: rowData.groutTubesBottomQty || null,
            groutTubesBottomType: rowData.groutTubesBottomType || null,
            groutTubesTopQty: rowData.groutTubesTopQty || null,
            groutTubesTopType: rowData.groutTubesTopType || null,
            // Ferrules & Fitments
            ferrulesQty: rowData.ferrulesQty || null,
            ferrulesType: rowData.ferrulesType || null,
            fitmentsQty2: rowData.fitmentsQty2 || null,
            fitmentsType2: rowData.fitmentsType2 || null,
            fitmentsQty3: rowData.fitmentsQty3 || null,
            fitmentsType3: rowData.fitmentsType3 || null,
            fitmentsQty4: rowData.fitmentsQty4 || null,
            fitmentsType4: rowData.fitmentsType4 || null,
            // Plates
            platesQty: rowData.platesQty || null,
            platesType: rowData.platesType || null,
            platesQty2: rowData.platesQty2 || null,
            platesType2: rowData.platesType2 || null,
            platesQty3: rowData.platesQty3 || null,
            platesType3: rowData.platesType3 || null,
            platesQty4: rowData.platesQty4 || null,
            platesType4: rowData.platesType4 || null,
            // Dowel bars
            dowelBarsLength: rowData.dowelBarsLength || null,
            dowelBarsQty: rowData.dowelBarsQty || null,
            dowelBarsType: rowData.dowelBarsType || null,
            dowelBarsLength2: rowData.dowelBarsLength2 || null,
            dowelBarsQty2: rowData.dowelBarsQty2 || null,
            dowelBarsType2: rowData.dowelBarsType2 || null,
            // Lifters
            lifterQtyA: rowData.lifterQtyA || null,
            liftersType: rowData.liftersType || null,
            lifterQtyB: rowData.lifterQtyB || null,
            safetyLiftersType: rowData.safetyLiftersType || null,
            lifterQtyC: rowData.lifterQtyC || null,
            faceLiftersType: rowData.faceLiftersType || null,
            // Other Inserts
            insertsQtyD: rowData.insertsQtyD || null,
            insertTypeD: rowData.insertTypeD || null,
            unitCheck: rowData.unitCheck || null,
            order: rowData.order || null,
            // Reo bar counts
            reoR6: rowData.reoR6 || null,
            reoN10: rowData.reoN10 || null,
            reoN12: rowData.reoN12 || null,
            reoN16: rowData.reoN16 || null,
            reoN20: rowData.reoN20 || null,
            reoN24: rowData.reoN24 || null,
            reoN28: rowData.reoN28 || null,
            reoN32: rowData.reoN32 || null,
            // Mesh counts
            meshSl82: rowData.meshSl82 || null,
            meshSl92: rowData.meshSl92 || null,
            meshSl102: rowData.meshSl102 || null,
            // Dowel counts
            dowelN20: rowData.dowelN20 || null,
            dowelN24: rowData.dowelN24 || null,
            dowelN28: rowData.dowelN28 || null,
            dowelN32: rowData.dowelN32 || null,
            dowelN36: rowData.dowelN36 || null,
            // Totals
            reoTons: rowData.reoTons || null,
            dowelsTons: rowData.dowelsTons || null,
            totalReo: rowData.totalReo || null,
            totalKgM3: rowData.totalKgM3 || null,
            contract: rowData.contract || null,
            reoContract: rowData.reoContract || null,
          });
          
          sheetResult.created++;
          existingPanelSourceIds.add(panelSourceId);
        }
        
        results.push(sheetResult);
      }
      
      const allErrors: string[] = [];
      for (const sheetResult of results) {
        for (const err of sheetResult.errors) {
          allErrors.push(`[${sheetResult.sheetName}] ${err}`);
        }
      }
      
      if (allErrors.length > 0) {
        return res.status(400).json({
          error: `Import failed: ${allErrors.length} error(s) found. No panels were imported.`,
          details: allErrors.slice(0, 20),
          sheets: results.map(r => ({ sheetName: r.sheetName, errors: r.errors })),
        });
      }
      
      if (panelsToImport.length === 0) {
        return res.status(400).json({
          error: "No panels found to import. Check that the file has valid TakeOff data.",
        });
      }
      
      let imported = 0;
      let importErrors: string[] = [];
      
      try {
        const importResult = await storage.importEstimatePanels(panelsToImport);
        imported = importResult.imported;
        importErrors = importResult.errors || [];
        for (const panelId of importResult.importedIds) {
          logPanelChange(panelId, "Panel imported from estimate", req.session.userId, { changedFields: { source: "estimate_import" }, newLifecycleStatus: 0 });
        }
      } catch (err: unknown) {
        importErrors.push(err instanceof Error ? err.message : String(err));
      }
      
      const totals = {
        created: results.reduce((sum, r) => sum + r.created, 0),
        duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        imported,
        sheetsProcessed: results.length,
      };
      
      res.json({
        success: true, totals, sheets: results,
        errors: importErrors.length > 0 ? importErrors.slice(0, 10) : undefined,
      });
    } catch (error: unknown) {
      logger.error({ err: error }, "Estimate import error");
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import estimate" });
    }
  }
);

export const panelImportRouter = router;
