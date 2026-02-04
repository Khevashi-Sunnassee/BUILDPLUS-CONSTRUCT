import { Router, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage, sha256Hex } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// GET /api/panels - Get panels with filters
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const jobId = req.query.jobId as string | undefined;
  const level = req.query.level as string | undefined;
  
  if (jobId && level) {
    const panels = await storage.getPanelsByJobAndLevel(jobId, level);
    res.json(panels);
  } else if (jobId) {
    const panels = await storage.getPanelsByJob(jobId);
    res.json(panels);
  } else {
    const panels = await storage.getAllPanelRegisterItems();
    res.json(panels);
  }
});

// GET /api/panels/by-job/:jobId - Get panels by job
router.get("/by-job/:jobId", requireAuth, async (req: Request, res: Response) => {
  const panels = await storage.getPanelsByJob(req.params.jobId as string);
  res.json(panels);
});

// GET /api/panels/approved-for-production - Get panels approved for production
router.get("/approved-for-production", requireAuth, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.query;
    const panels = await storage.getPanelsApprovedForProduction(jobId as string | undefined);
    res.json(panels);
  } catch (error: any) {
    console.error("Error fetching approved panels:", error);
    res.status(500).json({ error: "Failed to fetch approved panels" });
  }
});

// PUT /api/panels/:id/document-status - Update panel document status
router.put("/:id/document-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentStatus } = req.body;
    if (!documentStatus || !["DRAFT", "IFA", "IFC", "APPROVED"].includes(documentStatus)) {
      return res.status(400).json({ error: "Invalid document status. Must be DRAFT, IFA, IFC, or APPROVED" });
    }
    
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    if (documentStatus === "APPROVED") {
      const user = (req as any).user;
      if (!user || !["MANAGER", "ADMIN"].includes(user.role)) {
        return res.status(403).json({ error: "Only managers or admins can approve documents for production" });
      }
      if (panel.documentStatus !== "IFC") {
        return res.status(400).json({ error: "Panel must be in IFC status before it can be approved for production" });
      }
    }
    
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      documentStatus 
    });
    res.json(updatedPanel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update document status" });
  }
});

// =============== ADMIN PANEL ENDPOINTS ===============

// GET /api/admin/panels/:id - Get single panel
router.get("/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const panel = await storage.getPanelRegisterItem(req.params.id as string);
  if (!panel) return res.status(404).json({ error: "Panel not found" });
  res.json(panel);
});

// POST /api/admin/panels - Create panel
router.post("/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const panel = await storage.createPanelRegisterItem(req.body);
    res.json(panel);
  } catch (error: any) {
    if (error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "Panel with this mark already exists for this job" });
    }
    res.status(400).json({ error: error.message || "Failed to create panel" });
  }
});

// PUT /api/admin/panels/:id - Update panel
router.put("/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const panel = await storage.updatePanelRegisterItem(req.params.id as string, req.body);
  res.json(panel);
});

// POST /api/admin/panels/:id/validate - Validate panel
router.post("/admin/:id/validate", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const panel = await storage.getPanelRegisterItem(req.params.id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    if (panel.status !== "PENDING") {
      return res.status(400).json({ error: "Only panels with PENDING status can be validated" });
    }
    const updatedPanel = await storage.updatePanelRegisterItem(req.params.id as string, { 
      status: "NOT_STARTED" 
    });
    res.json(updatedPanel);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to validate panel" });
  }
});

// DELETE /api/admin/panels/:id - Delete panel
router.delete("/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deletePanelRegisterItem(req.params.id as string);
  res.json({ ok: true });
});

// GET /api/admin/panels/source-counts - Get panel counts by source
router.get("/admin/source-counts", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const counts = await storage.getPanelCountsBySource();
  res.json(counts);
});

// DELETE /api/admin/panels/by-source/:source - Delete all panels by source
router.delete("/admin/by-source/:source", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const source = parseInt(String(req.params.source));
    if (![1, 2, 3].includes(source)) {
      return res.status(400).json({ error: "Invalid source. Must be 1 (Manual), 2 (Excel), or 3 (Estimate)" });
    }
    
    const hasRecords = await storage.panelsWithSourceHaveRecords(source);
    if (hasRecords) {
      return res.status(400).json({ 
        error: "Cannot delete panels that have production records or are approved for production" 
      });
    }
    
    const deletedCount = await storage.deletePanelsBySource(source);
    res.json({ deleted: deletedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete panels" });
  }
});

// POST /api/admin/panels/import - Import panels from Excel
router.post("/admin/import", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { data, jobId } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: "Invalid import data" });
    }
    
    const allJobs = await storage.getAllJobs();
    const jobsByNumber: Record<string, typeof allJobs[0]> = {};
    allJobs.forEach(job => {
      jobsByNumber[job.jobNumber.toLowerCase()] = job;
    });
    
    const panelTypeConfigs = await storage.getAllPanelTypes();
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
      row: any;
      rowNumber: number;
      resolvedJob: any;
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
        jobId: resolvedJob.id,
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
      };
    });
    
    const result = await storage.importPanelRegister(panelsToImport);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Import failed" });
  }
});

// POST /api/jobs/:jobId/panels/import-estimate - Import estimate from Excel file
router.post("/jobs/:jobId/import-estimate", 
  requireAuth, 
  requireRole("ADMIN", "MANAGER"),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const replace = req.body.replace === "true";
      
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
      
      console.log(`[Estimate Import] ======= NEW IMPORT STARTED =======`);
      console.log(`[Estimate Import] File: "${fileName}" (${fileBuffer.length} bytes, hash: ${fileHash.substring(0, 12)}...)`);
      
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      
      console.log(`[Estimate Import] All sheet names in workbook:`, workbook.SheetNames);
      
      const takeoffSheets = workbook.SheetNames.filter(name => {
        const normalized = name.toLowerCase().replace(/[\s\-]/g, "");
        return normalized.includes("takeoff");
      });
      
      console.log(`[Estimate Import] Detected TakeOff sheets:`, takeoffSheets);
      
      if (takeoffSheets.length === 0) {
        console.log(`[Estimate Import] ERROR: No TakeOff sheets found`);
        return res.status(400).json({ error: "No TakeOff sheets found in the workbook" });
      }
      
      if (replace) {
        await storage.deletePanelsByJobAndSource(String(jobId), 3);
      }
      
      const panelTypeConfigs = await storage.getAllPanelTypes();
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
      
      const results: any[] = [];
      const panelsToImport: any[] = [];
      const existingPanelSourceIds = await storage.getExistingPanelSourceIds(String(jobId));
      
      const headerMapping: Record<string, string> = {
        "column": "panelMark",
        "column no": "panelMark",
        "columnno": "panelMark",
        "panelmark": "panelMark",
        "panel mark": "panelMark",
        "mark": "panelMark",
        "element": "panelMark",
        "building": "building",
        "zone": "zone",
        "structural elevation number": "structuralElevation",
        "structural elevation no": "structuralElevation",
        "structuralelevation": "structuralElevation",
        "structuralelevationno": "structuralElevation",
        "level": "level",
        "column type": "panelType",
        "columntype": "panelType",
        "paneltype": "panelType",
        "panel type": "panelType",
        "type": "panelType",
        "reckli detail": "reckliDetail",
        "recklidetail": "reckliDetail",
        "thickness": "thickness",
        "width": "width",
        "height": "height",
        "gross area m2": "areaM2",
        "gross area": "areaM2",
        "grossaream2": "areaM2",
        "net area m2": "areaM2",
        "net area": "areaM2",
        "netaream2": "areaM2",
        "area": "areaM2",
        "concrete strength mpa": "concreteStrength",
        "concrete strength": "concreteStrength",
        "concretestrength": "concreteStrength",
        "concretestrengthmpa": "concreteStrength",
        "vol m3": "volumeM3",
        "vol": "volumeM3",
        "volm3": "volumeM3",
        "volume": "volumeM3",
        "weight t": "weightT",
        "weight": "weightT",
        "weightt": "weightT",
        "mass": "weightT",
        "colum qty": "qty",
        "columqty": "qty",
        "qty": "qty",
        "quantity": "qty",
        "rebates": "rebates",
      };
      
      for (const sheetName of takeoffSheets) {
        const sheetResult = {
          sheetName,
          takeoffCategory: "",
          headerRow: -1,
          created: 0,
          duplicates: 0,
          skipped: 0,
          errors: [] as string[],
        };
        
        let category = sheetName
          .replace(/takeoff/gi, "")
          .replace(/take off/gi, "")
          .replace(/take-off/gi, "")
          .trim();
        if (!category) category = "Uncategorised";
        sheetResult.takeoffCategory = category;
        
        const sheet = workbook.Sheets[sheetName];
        const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 });
        
        let headerRow = -1;
        let headers: string[] = [];
        const requiredHeaders = ["column", "level", "thickness", "width", "height", "vol", "weight"];
        
        for (let i = 0; i < Math.min(20, data.length); i++) {
          const row = data[i];
          if (!row || row.length < 5) continue;
          
          const normalizedCells = row.map((cell: any) => 
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
          console.log(`[Estimate Import] Sheet "${sheetName}" - Could not find header row`);
          console.log(`[Estimate Import] First 5 rows:`, data.slice(0, 5).map((r: any) => 
            r?.slice(0, 8).map((c: any) => String(c || "").substring(0, 30))
          ));
          sheetResult.errors.push("Could not find header row - sheet may have different column structure");
          results.push(sheetResult);
          continue;
        }
        
        sheetResult.headerRow = headerRow + 1;
        
        console.log(`[Estimate Import] Sheet "${sheetName}" - Headers found at row ${headerRow + 1}:`, headers.slice(0, 15));
        
        const colMapping: Record<number, string> = {};
        const priorityPatterns = [
          { patterns: ["column no", "columnno", "panel mark", "panelmark", "element", "mark", "column"], field: "panelMark" },
          { patterns: ["column type", "columntype", "panel type", "paneltype"], field: "panelType" },
          { patterns: ["structural elevation no", "structural elevation number", "structuralelevationno", "structuralelevation"], field: "structuralElevation" },
          { patterns: ["building"], field: "building" },
          { patterns: ["zone"], field: "zone" },
          { patterns: ["level"], field: "level" },
          { patterns: ["type"], field: "panelType" },
          { patterns: ["reckli detail", "recklidetail"], field: "reckliDetail" },
          { patterns: ["thickness"], field: "thickness" },
          { patterns: ["width"], field: "width" },
          { patterns: ["height"], field: "height" },
          { patterns: ["gross area", "net area", "area"], field: "areaM2" },
          { patterns: ["concrete strength", "concretestrength"], field: "concreteStrength" },
          { patterns: ["vol", "volume"], field: "volumeM3" },
          { patterns: ["weight", "mass"], field: "weightT" },
          { patterns: ["colum qty", "columqty", "qty", "quantity"], field: "qty" },
          { patterns: ["rebates"], field: "rebates" },
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
                console.log(`[Estimate Import] Sheet "${sheetName}" - Mapped column ${idx}: "${header}" -> ${field}`);
                break;
              }
            }
            if (colMapping[idx]) break;
          }
        });
        
        const mappedFields = Object.values(colMapping);
        console.log(`[Estimate Import] Sheet "${sheetName}" - Mapped fields:`, mappedFields);
        
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
          if (["total", "subtotal", "summary"].some(t => firstCell.includes(t))) {
            continue;
          }
          
          const nonEmptyCells = row.filter((c: any) => c !== null && c !== undefined && c !== "").length;
          if (!panelMark && nonEmptyCells < 3) {
            continue;
          }
          
          if (!panelMark) {
            sheetResult.skipped++;
            continue;
          }
          
          const rowData: Record<string, any> = {};
          Object.entries(colMapping).forEach(([colIdx, field]) => {
            rowData[field] = row[Number(colIdx)];
          });
          
          const thickness = parseFloat(rowData.thickness) || null;
          const width = parseFloat(rowData.width) || null;
          const height = parseFloat(rowData.height) || null;
          const areaM2 = parseFloat(rowData.areaM2) || null;
          const volumeM3 = parseFloat(rowData.volumeM3) || null;
          const weightT = parseFloat(rowData.weightT) || null;
          const qty = parseInt(rowData.qty) || 1;
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
            jobId,
            panelMark,
            panelType,
            building: buildingValue,
            zone: String(rowData.zone || ""),
            level: normalizedLevel,
            structuralElevation: String(rowData.structuralElevation || ""),
            reckliDetail: String(rowData.reckliDetail || ""),
            qty,
            takeoffCategory: category,
            concreteStrengthMpa: concreteStrength,
            panelThickness: thicknessMm ? String(thicknessMm) : null,
            loadWidth: widthMm ? String(widthMm) : null,
            loadHeight: heightMm ? String(heightMm) : null,
            panelArea: areaM2 ? String(areaM2) : null,
            panelVolume: volumeM3 ? String(volumeM3) : null,
            panelMass: weightKg ? String(weightKg) : null,
            sourceFileName: fileName,
            sourceSheet: sheetName,
            sourceRow: sourceRowNum,
            panelSourceId,
            source: 3,
            status: "PENDING" as const,
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
          sheets: results.map(r => ({
            sheetName: r.sheetName,
            errors: r.errors,
          })),
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
      } catch (err: any) {
        importErrors.push(err.message);
      }
      
      const totals = {
        created: results.reduce((sum, r) => sum + r.created, 0),
        duplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        imported,
        sheetsProcessed: results.length,
      };
      
      res.json({
        success: true,
        totals,
        sheets: results,
        errors: importErrors.length > 0 ? importErrors.slice(0, 10) : undefined,
      });
    } catch (error: any) {
      console.error("Estimate import error:", error);
      res.status(500).json({ error: error.message || "Failed to import estimate" });
    }
  }
);

// =============== PANEL AI/PRODUCTION APPROVAL ===============

// POST /api/admin/panels/:id/analyze-pdf - AI PDF analysis
router.post("/admin/:id/analyze-pdf", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pdfBase64 } = req.body;
    
    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF data is required" });
    }
    
    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: `You are a technical document analyzer specializing in precast concrete panel specifications.
Extract the following fields from the provided panel drawing/specification document. Return a JSON object with these fields:
- loadWidth: Panel load width in mm (string)
- loadHeight: Panel load height in mm (string)  
- panelThickness: Panel thickness in mm (string)
- panelVolume: Panel volume in cubic meters (string)
- panelMass: Panel mass in kg (string)
- panelArea: Panel area in square meters (string)
- day28Fc: 28-day concrete compressive strength in MPa (string)
- liftFcm: Minimum concrete strength at lift in MPa (string)
- panelMark: Panel mark/identifier (string)

If a value cannot be determined from the document, use null for that field.
Return ONLY valid JSON, no explanation text.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this precast panel specification document and extract the panel properties. Panel Mark on file: ${panel.panelMark}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_completion_tokens: 1000,
    });
    
    const content = response.choices[0]?.message?.content || "{}";
    let extractedData;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse OpenAI response:", content);
      extractedData = {};
    }
    
    res.json({
      success: true,
      extracted: extractedData,
      panelId: id,
    });
  } catch (error: any) {
    console.error("PDF analysis error:", error);
    res.status(500).json({ 
      error: "Failed to analyze PDF", 
      details: error.message 
    });
  }
});

// POST /api/admin/panels/:id/approve-production - Approve panel for production
router.post("/admin/:id/approve-production", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId!;
    const { 
      loadWidth, 
      loadHeight, 
      panelThickness, 
      panelVolume, 
      panelMass, 
      panelArea, 
      day28Fc, 
      liftFcm,
      concreteStrengthMpa,
      rotationalLifters,
      primaryLifters,
      productionPdfUrl 
    } = req.body;
    
    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const updated = await storage.approvePanelForProduction(id as string, userId, {
      loadWidth,
      loadHeight,
      panelThickness,
      panelVolume,
      panelMass,
      panelArea,
      day28Fc,
      liftFcm,
      concreteStrengthMpa,
      rotationalLifters,
      primaryLifters,
      productionPdfUrl,
    });
    
    res.json({ success: true, panel: updated });
  } catch (error: any) {
    console.error("Approval error:", error);
    res.status(500).json({ error: "Failed to approve panel", details: error.message });
  }
});

// POST /api/admin/panels/:id/revoke-production - Revoke production approval
router.post("/admin/:id/revoke-production", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const updated = await storage.revokePanelProductionApproval(id as string);
    
    res.json({ success: true, panel: updated });
  } catch (error: any) {
    console.error("Revoke error:", error);
    res.status(500).json({ error: "Failed to revoke approval", details: error.message });
  }
});

// =============== PANEL TYPES ENDPOINTS ===============

// GET /api/admin/panel-types - Get all panel types (admin)
router.get("/types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const types = await storage.getAllPanelTypes();
  res.json(types);
});

// GET /api/admin/panel-types/cost-summaries - Get cost summaries
router.get("/types/admin/cost-summaries", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const types = await storage.getAllPanelTypes();
    const summaries: Record<string, { totalCostPercent: number; profitMargin: number }> = {};
    
    for (const type of types) {
      const components = await storage.getCostComponentsByPanelType(type.id);
      const totalCostPercent = components.reduce((sum, c) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
      summaries[type.id] = {
        totalCostPercent,
        profitMargin: 100 - totalCostPercent,
      };
    }
    
    res.json(summaries);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch cost summaries" });
  }
});

// GET /api/admin/panel-types/:id - Get single panel type (admin)
router.get("/types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const type = await storage.getPanelType(req.params.id as string);
  if (!type) return res.status(404).json({ error: "Panel type not found" });
  res.json(type);
});

// POST /api/admin/panel-types - Create panel type
router.post("/types/admin", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const type = await storage.createPanelType(req.body);
    res.json(type);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create panel type" });
  }
});

// PUT /api/admin/panel-types/:id - Update panel type
router.put("/types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  const type = await storage.updatePanelType(req.params.id as string, req.body);
  if (!type) return res.status(404).json({ error: "Panel type not found" });
  res.json(type);
});

// DELETE /api/admin/panel-types/:id - Delete panel type
router.delete("/types/admin/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  await storage.deletePanelType(req.params.id as string);
  res.json({ ok: true });
});

// GET /api/panel-types/:id/cost-components - Get cost components for panel type
router.get("/types/:id/cost-components", requireAuth, async (req: Request, res: Response) => {
  const components = await storage.getCostComponentsByPanelType(req.params.id as string);
  res.json(components);
});

// PUT /api/panel-types/:id/cost-components - Update cost components
router.put("/types/:id/cost-components", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const { components } = req.body;
    if (!Array.isArray(components)) {
      return res.status(400).json({ error: "components array required" });
    }
    const total = components.reduce((sum: number, c: any) => sum + (parseFloat(c.percentageOfRevenue) || 0), 0);
    if (total > 100) {
      return res.status(400).json({ error: "Total percentage cannot exceed 100%" });
    }
    const inserted = await storage.replaceCostComponents(req.params.id as string, 
      components.map((c: any, i: number) => ({
        panelTypeId: req.params.id as string,
        name: c.name,
        percentageOfRevenue: String(c.percentageOfRevenue),
        sortOrder: i,
      }))
    );
    res.json(inserted);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update cost components" });
  }
});

// GET /api/panel-types - Get active panel types
router.get("/types", requireAuth, async (req: Request, res: Response) => {
  const types = await storage.getAllPanelTypes();
  res.json(types.filter(t => t.isActive));
});

export const panelsRouter = router;
