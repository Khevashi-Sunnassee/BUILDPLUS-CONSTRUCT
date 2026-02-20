import { Router } from "express";
import {
  requireAuth, requireRole, Request, Response,
  db, logger, assets,
  ASSET_CATEGORIES, ASSET_STATUSES, ASSET_CONDITIONS, ASSET_FUNDING_METHODS,
  upload, generateAssetTag,
  TEMPLATE_COLUMNS, HEADER_TO_KEY, SPREADSHEET_ALIASES,
  mapCategoryFromSpreadsheet, aiCategorizeBatch,
  parseExcelDate, parseNumber,
  eq,
} from "./shared";
import { suppliers } from "@shared/schema";
import ExcelJS from "exceljs";

const router = Router();

router.get("/api/admin/assets/template", requireAuth, async (_req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Asset Register Template");
    sheet.columns = TEMPLATE_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    const catSheet = workbook.addWorksheet("Validation Data");
    catSheet.getColumn(1).width = 30;
    catSheet.getCell("A1").value = "Valid Categories";
    catSheet.getCell("A1").font = { bold: true };
    ASSET_CATEGORIES.forEach((cat, i) => {
      catSheet.getCell(`A${i + 2}`).value = cat;
    });
    catSheet.getColumn(2).width = 15;
    catSheet.getCell("B1").value = "Valid Statuses";
    catSheet.getCell("B1").font = { bold: true };
    ASSET_STATUSES.forEach((s, i) => {
      catSheet.getCell(`B${i + 2}`).value = s;
    });
    catSheet.getColumn(3).width = 15;
    catSheet.getCell("C1").value = "Valid Conditions";
    catSheet.getCell("C1").font = { bold: true };
    ASSET_CONDITIONS.forEach((c, i) => {
      catSheet.getCell(`C${i + 2}`).value = c;
    });
    catSheet.getColumn(4).width = 15;
    catSheet.getCell("D1").value = "Funding Methods";
    catSheet.getCell("D1").font = { bold: true };
    ASSET_FUNDING_METHODS.forEach((f, i) => {
      catSheet.getCell(`D${i + 2}`).value = f;
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Asset_Register_Template.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to generate asset template");
    res.status(500).json({ error: "Failed to generate template" });
  }
});

router.post("/api/admin/assets/import", requireRole("ADMIN"), upload.single("file"), async (req: Request, res: Response) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    let sheet = workbook.worksheets[0];
    for (const ws of workbook.worksheets) {
      const name = ws.name.toLowerCase().trim();
      if (name.includes("all assets") || name.includes("fy 24") || name === "asset register template") {
        sheet = ws;
        break;
      }
    }

    let headerRowIndex = 0;
    const columnMap: Record<number, string> = {};
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      let matchCount = 0;
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = row.getCell(c);
        let val = cell.value;
        if (val && typeof val === "object" && "richText" in val) {
          val = (val as {richText: {text: string}[]}).richText.map((t) => t.text).join("");
        }
        if (!val) continue;
        const headerStr = String(val).toLowerCase().trim();
        const mappedKey = HEADER_TO_KEY[headerStr] || SPREADSHEET_ALIASES[headerStr];
        if (mappedKey) {
          matchCount++;
          if (mappedKey !== "_skip") {
            columnMap[c] = mappedKey;
          }
        }
      }
      if (matchCount >= 3) {
        headerRowIndex = r;
        break;
      }
    }

    if (!headerRowIndex) {
      const allHeaders: string[] = [];
      const row1 = sheet.getRow(1);
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = row1.getCell(c);
        let val = cell.value;
        if (val && typeof val === "object" && "richText" in val) {
          val = (val as {richText: {text: string}[]}).richText.map((t) => t.text).join("");
        }
        if (val) allHeaders.push(String(val).trim());
      }
      logger.warn({ allHeaders, sheetName: sheet.name, rowCount: sheet.rowCount }, "Could not find header row");
      return res.status(400).json({ error: `Could not find header row. Found columns: ${allHeaders.join(", ")}. Please ensure the spreadsheet has recognizable column headers.` });
    }

    logger.info({ headerRowIndex, columnMap, sheetName: sheet.name }, "Asset import column mapping");

    const imported: Record<string, unknown>[] = [];
    const errors: string[] = [];
    let rowNum = 0;

    const parsedRows: { rowNum: number; name: string; rowData: Record<string, unknown>; manualCategory: string | null; rawCategory: string | null }[] = [];

    for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const rowData: Record<string, unknown> = {};
      let hasData = false;

      for (const [colStr, key] of Object.entries(columnMap)) {
        const col = parseInt(colStr);
        const cell = row.getCell(col);
        let val = cell.value;
        if (val && typeof val === "object" && "result" in val) val = (val as unknown as Record<string, unknown>).result as typeof val;
        if (val && typeof val === "object" && "richText" in val) val = (val as {richText: {text: string}[]}).richText.map((t) => t.text).join("");
        if (val !== null && val !== undefined && val !== "") {
          hasData = true;
          rowData[key] = val;
        }
      }

      if (!hasData) continue;
      rowNum++;

      const name = rowData.name ? String(rowData.name).trim() : null;
      if (!name) {
        errors.push(`Row ${rowNum}: Missing asset name, skipped`);
        continue;
      }

      let manualCategory: string | null = null;
      const rawCat = rowData.category ? String(rowData.category).trim() : null;
      if (rawCat && ASSET_CATEGORIES.includes(rawCat as typeof ASSET_CATEGORIES[number])) {
        manualCategory = rawCat;
      } else if (rawCat) {
        const mapped = mapCategoryFromSpreadsheet(rawCat);
        if (mapped !== "Other") manualCategory = mapped;
      }
      if (!manualCategory && rowData.description) {
        const descVal = String(rowData.description).trim();
        if (descVal.length < 40) {
          const mapped = mapCategoryFromSpreadsheet(descVal);
          if (mapped !== "Other") {
            manualCategory = mapped;
          } else if (ASSET_CATEGORIES.includes(descVal as typeof ASSET_CATEGORIES[number])) {
            manualCategory = descVal;
          }
        }
      }

      parsedRows.push({ rowNum, name, rowData, manualCategory, rawCategory: rawCat });
    }

    if (parsedRows.length > 0) {
      logger.info({ rowData: parsedRows[0].rowData, name: parsedRows[0].name, manualCategory: parsedRows[0].manualCategory, rawCategory: parsedRows[0].rawCategory }, "Asset import first row sample");
    }
    logger.info(`Asset import parsed ${parsedRows.length} rows from ${rowNum} total`);

    const needsAI = parsedRows.filter(r => !r.manualCategory);
    let aiResults: Record<number, string> = {};
    if (needsAI.length > 0) {
      const aiItems = needsAI.map(r => ({
        index: r.rowNum,
        name: r.name,
        description: r.rowData.description ? String(r.rowData.description).trim() : undefined,
      }));
      aiResults = await aiCategorizeBatch(aiItems);
      logger.info(`AI categorized ${Object.keys(aiResults).length}/${needsAI.length} assets`);
    }

    const supplierCache: Record<string, string> = {};
    const existingSuppliers = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.companyId, companyId));
    for (const s of existingSuppliers) {
      supplierCache[s.name.toLowerCase().trim()] = s.id;
    }

    async function findOrCreateSupplier(supplierName: string): Promise<string> {
      const key = supplierName.toLowerCase().trim();
      if (supplierCache[key]) return supplierCache[key];
      const [newSupplier] = await db.insert(suppliers).values({
        companyId: companyId!,
        name: supplierName.trim(),
        isActive: true,
      }).returning({ id: suppliers.id });
      supplierCache[key] = newSupplier.id;
      return newSupplier.id;
    }

    for (const parsedRow of parsedRows) {
      const { name, rowData } = parsedRow;
      let category = parsedRow.manualCategory
        || aiResults[parsedRow.rowNum]
        || (parsedRow.rawCategory ? mapCategoryFromSpreadsheet(parsedRow.rawCategory) : null)
        || "Other";

      try {
        const assetTag = await generateAssetTag(companyId);
        const insertData: Record<string, unknown> = {
          companyId,
          assetTag,
          name,
          category,
          status: "active",
          createdBy: req.session?.userId || null,
        };

        if (rowData.supplier) {
          const supplierName = String(rowData.supplier).trim();
          insertData.supplier = supplierName;
          try {
            insertData.supplierId = await findOrCreateSupplier(supplierName);
          } catch (err: unknown) {
            logger.warn(`Failed to create supplier "${supplierName}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        if (rowData.description) insertData.description = String(rowData.description).trim();
        if (rowData.serialNumber) insertData.serialNumber = String(rowData.serialNumber).trim();
        if (rowData.registrationNumber) insertData.registrationNumber = String(rowData.registrationNumber).trim();
        if (rowData.remarks) insertData.remarks = String(rowData.remarks).trim();
        if (rowData.manufacturer) insertData.manufacturer = String(rowData.manufacturer).trim();
        if (rowData.model) insertData.model = String(rowData.model).trim();
        if (rowData.location) insertData.location = String(rowData.location).trim();
        if (rowData.department) insertData.department = String(rowData.department).trim();
        if (rowData.assignedTo) insertData.assignedTo = String(rowData.assignedTo).trim();
        if (rowData.fundingMethod) insertData.fundingMethod = String(rowData.fundingMethod).trim();
        if (rowData.depreciationMethod) insertData.depreciationMethod = String(rowData.depreciationMethod).trim();
        if (rowData.engineNumber) insertData.engineNumber = String(rowData.engineNumber).trim();
        if (rowData.vinNumber) insertData.vinNumber = String(rowData.vinNumber).trim();
        if (rowData.yearOfManufacture) insertData.yearOfManufacture = String(rowData.yearOfManufacture).trim();
        if (rowData.countryOfOrigin) insertData.countryOfOrigin = String(rowData.countryOfOrigin).trim();
        if (rowData.specifications) insertData.specifications = String(rowData.specifications).trim();
        if (rowData.barcode) insertData.barcode = String(rowData.barcode).trim();
        if (rowData.capexRequestId) insertData.capexRequestId = String(rowData.capexRequestId).trim();
        if (rowData.capexDescription) insertData.capexDescription = String(rowData.capexDescription).trim();
        if (rowData.lessor) insertData.lessor = String(rowData.lessor).trim();
        if (rowData.lender) insertData.lender = String(rowData.lender).trim();
        if (rowData.insuranceProvider) insertData.insuranceProvider = String(rowData.insuranceProvider).trim();
        if (rowData.insurancePolicyNumber) insertData.insurancePolicyNumber = String(rowData.insurancePolicyNumber).trim();
        if (rowData.insuranceStatus) insertData.insuranceStatus = String(rowData.insuranceStatus).trim();
        if (rowData.insuranceNotes) insertData.insuranceNotes = String(rowData.insuranceNotes).trim();

        const purchaseDate = parseExcelDate(rowData.purchaseDate);
        if (purchaseDate) insertData.purchaseDate = purchaseDate;
        const warrantyExpiry = parseExcelDate(rowData.warrantyExpiry);
        if (warrantyExpiry) insertData.warrantyExpiry = warrantyExpiry;
        const leaseStartDate = parseExcelDate(rowData.leaseStartDate);
        if (leaseStartDate) insertData.leaseStartDate = leaseStartDate;
        const leaseEndDate = parseExcelDate(rowData.leaseEndDate);
        if (leaseEndDate) insertData.leaseEndDate = leaseEndDate;
        const insuranceStartDate = parseExcelDate(rowData.insuranceStartDate);
        if (insuranceStartDate) insertData.insuranceStartDate = insuranceStartDate;
        const insuranceExpiryDate = parseExcelDate(rowData.insuranceExpiryDate);
        if (insuranceExpiryDate) insertData.insuranceExpiryDate = insuranceExpiryDate;

        const purchasePrice = parseNumber(rowData.purchasePrice);
        if (purchasePrice !== null) insertData.purchasePrice = String(purchasePrice);
        const currentValue = parseNumber(rowData.currentValue);
        if (currentValue !== null) insertData.currentValue = String(currentValue);
        const accDep = parseNumber(rowData.accumulatedDepreciation);
        if (accDep !== null) insertData.accumulatedDepreciation = String(accDep);
        const depThisPeriod = parseNumber(rowData.depreciationThisPeriod);
        if (depThisPeriod !== null) insertData.depreciationThisPeriod = String(depThisPeriod);
        const bookVal = parseNumber(rowData.bookValue);
        if (bookVal !== null) insertData.bookValue = String(bookVal);
        const depRate = parseNumber(rowData.depreciationRate);
        if (depRate !== null) insertData.depreciationRate = String(depRate);
        const opHours = parseNumber(rowData.operatingHours);
        if (opHours !== null) insertData.operatingHours = String(opHours);
        const leasePmt = parseNumber(rowData.leaseMonthlyPayment);
        if (leasePmt !== null) insertData.leaseMonthlyPayment = String(leasePmt);
        const balloon = parseNumber(rowData.balloonPayment);
        if (balloon !== null) insertData.balloonPayment = String(balloon);
        const loanAmt = parseNumber(rowData.loanAmount);
        if (loanAmt !== null) insertData.loanAmount = String(loanAmt);
        const intRate = parseNumber(rowData.interestRate);
        if (intRate !== null) insertData.interestRate = String(intRate);
        const insPrem = parseNumber(rowData.insurancePremium);
        if (insPrem !== null) insertData.insurancePremium = String(insPrem);
        const insExcess = parseNumber(rowData.insuranceExcess);
        if (insExcess !== null) insertData.insuranceExcess = String(insExcess);

        const qty = parseNumber(rowData.quantity);
        if (qty !== null) insertData.quantity = Math.round(qty);
        const usefulLife = parseNumber(rowData.usefulLifeYears);
        if (usefulLife !== null) insertData.usefulLifeYears = Math.round(usefulLife);
        const yearsDep = parseNumber(rowData.yearsDepreciated);
        if (yearsDep !== null) insertData.yearsDepreciated = Math.round(yearsDep);
        const leaseTerm = parseNumber(rowData.leaseTerm);
        if (leaseTerm !== null) insertData.leaseTerm = Math.round(leaseTerm);
        const loanTerm = parseNumber(rowData.loanTerm);
        if (loanTerm !== null) insertData.loanTerm = Math.round(loanTerm);

        const [created] = await db.insert(assets).values(insertData as typeof assets.$inferInsert).returning();
        imported.push({ id: created.id, name: created.name, assetTag: created.assetTag });
      } catch (rowError: unknown) {
        errors.push(`Row ${parsedRow.rowNum} (${name}): ${rowError instanceof Error ? rowError.message : String(rowError)}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 50),
      assets: imported.slice(0, 20),
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Failed to import assets");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import assets" });
  }
});

export default router;
