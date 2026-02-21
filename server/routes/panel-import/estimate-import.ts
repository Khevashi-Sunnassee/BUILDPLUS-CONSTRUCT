import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { storage, sha256Hex } from "../../storage";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { logPanelChange } from "../../services/panel-audit.service";
import { estimateImportBodySchema, upload, buildPanelTypeMap, PRIORITY_PATTERNS } from "./shared";

const router = Router();

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
      
      const panelTypeResult = await buildPanelTypeMap(req.companyId);
      if (!panelTypeResult) {
        return res.status(400).json({ 
          error: "No panel types configured in system. Please add panel types in Settings before importing." 
        });
      }
      const { panelTypesByNameOrCode, panelTypesList } = panelTypeResult;
      
      const results: { sheetName: string; takeoffCategory?: string; created: number; duplicates: number; skipped: number; errors: string[] }[] = [];
      const panelsToImport: Record<string, unknown>[] = [];
      const existingPanelSourceIds = await storage.getExistingPanelSourceIds(String(jobId));
      
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
        
        headers.forEach((header, idx) => {
          if (colMapping[idx]) return;
          const normalizedHeader = header.replace(/\s+/g, " ").toLowerCase().trim();
          if (!normalizedHeader) return;
          
          for (const { patterns, field } of PRIORITY_PATTERNS) {
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
            numRebates: rowData.rebates ? parseInt(String(rowData.rebates)) || null : null,
            fireRate: rowData.fireRate || null,
            caulkingFire: rowData.caulkingFire || null,
            openings: rowData.openings || null,
            netWeight: rowData.netWeight || null,
            grossArea: rowData.grossArea || null,
            craneCapacityWeight: rowData.craneCapacityWeight || null,
            craneCheck: rowData.craneCheck || null,
            groutTableManual: rowData.groutTableManual || null,
            groutToUse: rowData.groutToUse || null,
            groutStrength: rowData.groutStrength || null,
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
            additionalReoQty1: rowData.additionalReoQty1 || null,
            additionalReoType1: rowData.additionalReoType1 || null,
            additionalReoQty2: rowData.additionalReoQty2 || null,
            additionalReoType2: rowData.additionalReoType2 || null,
            additionalReoQty3: rowData.additionalReoQty3 || null,
            additionalReoType3: rowData.additionalReoType3 || null,
            additionalReoQty4: rowData.additionalReoQty4 || null,
            additionalReoType4: rowData.additionalReoType4 || null,
            topFixingQty: rowData.topFixingQty || null,
            topFixingType: rowData.topFixingType || null,
            trimmerBarsQty: rowData.trimmerBarsQty || null,
            trimmerBarsType: rowData.trimmerBarsType || null,
            ligsReoQty: rowData.ligsReoQty || null,
            ligsReoType: rowData.ligsReoType || null,
            additionalReoType: rowData.additionalReoType || null,
            additionalReoQty: rowData.additionalReoQty || null,
            additionalReoFrlType: rowData.additionalReoFrlType || null,
            tieReinforcement: rowData.tieReinforcement || null,
            groutTubesBottomQty: rowData.groutTubesBottomQty || null,
            groutTubesBottomType: rowData.groutTubesBottomType || null,
            groutTubesTopQty: rowData.groutTubesTopQty || null,
            groutTubesTopType: rowData.groutTubesTopType || null,
            ferrulesQty: rowData.ferrulesQty || null,
            ferrulesType: rowData.ferrulesType || null,
            fitmentsQty2: rowData.fitmentsQty2 || null,
            fitmentsType2: rowData.fitmentsType2 || null,
            fitmentsQty3: rowData.fitmentsQty3 || null,
            fitmentsType3: rowData.fitmentsType3 || null,
            fitmentsQty4: rowData.fitmentsQty4 || null,
            fitmentsType4: rowData.fitmentsType4 || null,
            platesQty: rowData.platesQty || null,
            platesType: rowData.platesType || null,
            platesQty2: rowData.platesQty2 || null,
            platesType2: rowData.platesType2 || null,
            platesQty3: rowData.platesQty3 || null,
            platesType3: rowData.platesType3 || null,
            platesQty4: rowData.platesQty4 || null,
            platesType4: rowData.platesType4 || null,
            dowelBarsLength: rowData.dowelBarsLength || null,
            dowelBarsQty: rowData.dowelBarsQty || null,
            dowelBarsType: rowData.dowelBarsType || null,
            dowelBarsLength2: rowData.dowelBarsLength2 || null,
            dowelBarsQty2: rowData.dowelBarsQty2 || null,
            dowelBarsType2: rowData.dowelBarsType2 || null,
            lifterQtyA: rowData.lifterQtyA || null,
            liftersType: rowData.liftersType || null,
            lifterQtyB: rowData.lifterQtyB || null,
            safetyLiftersType: rowData.safetyLiftersType || null,
            lifterQtyC: rowData.lifterQtyC || null,
            faceLiftersType: rowData.faceLiftersType || null,
            insertsQtyD: rowData.insertsQtyD || null,
            insertTypeD: rowData.insertTypeD || null,
            unitCheck: rowData.unitCheck || null,
            order: rowData.order || null,
            reoR6: rowData.reoR6 || null,
            reoN10: rowData.reoN10 || null,
            reoN12: rowData.reoN12 || null,
            reoN16: rowData.reoN16 || null,
            reoN20: rowData.reoN20 || null,
            reoN24: rowData.reoN24 || null,
            reoN28: rowData.reoN28 || null,
            reoN32: rowData.reoN32 || null,
            meshSl82: rowData.meshSl82 || null,
            meshSl92: rowData.meshSl92 || null,
            meshSl102: rowData.meshSl102 || null,
            dowelN20: rowData.dowelN20 || null,
            dowelN24: rowData.dowelN24 || null,
            dowelN28: rowData.dowelN28 || null,
            dowelN32: rowData.dowelN32 || null,
            dowelN36: rowData.dowelN36 || null,
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

export default router;
