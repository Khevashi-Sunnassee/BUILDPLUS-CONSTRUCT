import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { storage } from "../storage";
import logger from "../lib/logger";
import { insertReoScheduleSchema, insertReoScheduleItemSchema } from "@shared/schema";
import { z } from "zod";
import { extractReoFromPdf } from "../services/reo-extraction.service";
import { ObjectStorageService } from "../replit_integrations/object_storage";

const router = Router();

router.get("/api/reo-schedules/ifc-panels", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const { jobId } = req.query;
    const panels = await storage.getIfcPanelsForProcurement(companyId);
    
    // Return flat array with job embedded in each panel to match frontend IfcPanelWithSchedule interface
    const results = [];
    for (const item of panels) {
      // Apply job filter if provided
      if (jobId && item.job.id !== jobId) {
        continue;
      }
      
      const existingSchedule = await storage.getReoScheduleByPanel(item.panel.id);
      
      results.push({
        ...item.panel,
        job: item.job,
        reoSchedule: existingSchedule || null,
      });
    }
    
    res.json(results);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching IFC panels for procurement");
    res.status(500).json({ message: "Failed to fetch IFC panels" });
  }
});

router.get("/api/reo-schedules", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const schedules = await storage.getReoSchedulesByCompany(companyId);
    res.json(schedules);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching reo schedules");
    res.status(500).json({ message: "Failed to fetch reo schedules" });
  }
});

router.get("/api/reo-schedules/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoScheduleWithDetails(id);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(schedule);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching reo schedule");
    res.status(500).json({ message: "Failed to fetch reo schedule" });
  }
});

router.get("/api/reo-schedules/panel/:panelId", requireAuth, async (req: Request, res: Response) => {
  try {
    const panelId = req.params.panelId as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoScheduleByPanel(panelId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found for panel" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const scheduleWithDetails = await storage.getReoScheduleWithDetails(schedule.id);
    res.json(scheduleWithDetails);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching reo schedule by panel");
    res.status(500).json({ message: "Failed to fetch reo schedule" });
  }
});

router.post("/api/reo-schedules", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    const userId = req.session.userId;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    const data = insertReoScheduleSchema.parse({
      ...req.body,
      companyId,
      createdById: userId,
    });

    const schedule = await storage.createReoSchedule(data);
    res.status(201).json(schedule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating reo schedule");
    res.status(500).json({ message: "Failed to create reo schedule" });
  }
});

router.patch("/api/reo-schedules/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const companyId = req.companyId;

    const existing = await storage.getReoSchedule(id);
    if (!existing) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (existing.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await storage.updateReoSchedule(id, req.body);
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating reo schedule");
    res.status(500).json({ message: "Failed to update reo schedule" });
  }
});

router.get("/api/reo-schedules/:scheduleId/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const items = await storage.getReoScheduleItems(scheduleId);
    res.json(items);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching reo schedule items");
    res.status(500).json({ message: "Failed to fetch reo schedule items" });
  }
});

router.post("/api/reo-schedules/:scheduleId/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const data = insertReoScheduleItemSchema.parse({
      ...req.body,
      scheduleId,
    });

    const item = await storage.createReoScheduleItem(data);
    res.status(201).json(item);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ err: error }, "Error creating reo schedule item");
    res.status(500).json({ message: "Failed to create reo schedule item" });
  }
});

router.patch("/api/reo-schedules/:scheduleId/items/:itemId", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const itemId = req.params.itemId as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await storage.updateReoScheduleItem(itemId, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Reo schedule item not found" });
    }

    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating reo schedule item");
    res.status(500).json({ message: "Failed to update reo schedule item" });
  }
});

router.delete("/api/reo-schedules/:scheduleId/items/:itemId", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const itemId = req.params.itemId as string;
    const companyId = req.companyId;

    const schedule = await storage.getReoSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await storage.deleteReoScheduleItem(itemId);
    res.status(204).send();
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting reo schedule item");
    res.status(500).json({ message: "Failed to delete reo schedule item" });
  }
});

router.post("/api/reo-schedules/:scheduleId/items/bulk-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const { itemIds, status } = req.body;
    const companyId = req.companyId;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: "itemIds array is required" });
    }

    if (!status || !["PENDING", "APPROVED", "REJECTED", "ORDERED"].includes(status)) {
      return res.status(400).json({ message: "Valid status is required" });
    }

    const schedule = await storage.getReoSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await storage.updateReoScheduleItemsStatus(scheduleId, itemIds, status);
    res.json(updated);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating reo schedule items status");
    res.status(500).json({ message: "Failed to update reo schedule items status" });
  }
});

router.post("/api/reo-schedules/:scheduleId/process", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const { pdfBase64 } = req.body;
    const companyId = req.companyId;

    const schedule = await storage.getReoScheduleWithDetails(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    let pdfData = pdfBase64;
    
    if (!pdfData && schedule.panel?.productionPdfUrl) {
      const objectStorage = new ObjectStorageService();
      const objectFile = await objectStorage.getObjectEntityFile(schedule.panel.productionPdfUrl);
      const chunks: Buffer[] = [];
      
      await new Promise<void>((resolve, reject) => {
        const stream = objectFile.createReadStream();
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve());
        stream.on("error", reject);
      });
      
      pdfData = Buffer.concat(chunks).toString("base64");
    }

    if (!pdfData) {
      return res.status(400).json({ message: "No PDF data available for processing" });
    }

    await storage.updateReoSchedule(scheduleId, { status: "PROCESSING" as any });

    const panelMark = schedule.panel?.panelMark || `Panel-${schedule.panelId}`;
    const extractionResult = await extractReoFromPdf(pdfData, panelMark);

    if (!extractionResult.success) {
      await storage.updateReoSchedule(scheduleId, { 
        status: "FAILED" as any,
        aiResponseRaw: extractionResult.rawResponse,
        notes: extractionResult.error,
      });
      return res.status(400).json({ 
        message: "AI extraction failed", 
        error: extractionResult.error 
      });
    }

    const itemsToCreate = extractionResult.items.map(item => ({
      ...item,
      scheduleId,
    }));

    const createdItems = await storage.createReoScheduleItemsBulk(itemsToCreate);

    await storage.updateReoSchedule(scheduleId, { 
      status: "COMPLETED" as any,
      processedAt: new Date(),
      aiModelUsed: extractionResult.modelUsed,
      aiResponseRaw: extractionResult.rawResponse,
    });

    res.json({ 
      message: "AI processing completed", 
      scheduleId,
      status: "COMPLETED",
      itemsCreated: createdItems.length,
      items: createdItems,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error during AI processing");
    res.status(500).json({ message: "Failed to process with AI" });
  }
});

router.post("/api/reo-schedules/:scheduleId/create-po", requireAuth, async (req: Request, res: Response) => {
  try {
    const scheduleId = req.params.scheduleId as string;
    const { supplierId, itemIds, notes } = req.body;
    const companyId = req.companyId;
    const userId = req.session.userId;

    if (!supplierId) {
      return res.status(400).json({ message: "Supplier ID is required" });
    }

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: "Item IDs are required" });
    }

    const schedule = await storage.getReoScheduleWithDetails(scheduleId);
    if (!schedule) {
      return res.status(404).json({ message: "Reo schedule not found" });
    }

    if (schedule.companyId !== companyId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const approvedItems = schedule.items?.filter(
      item => itemIds.includes(item.id) && item.status === "APPROVED"
    ) || [];

    if (approvedItems.length === 0) {
      return res.status(400).json({ message: "No approved items found for selected IDs" });
    }

    const poNumber = `REO-${schedule.panel?.panelMark || schedule.panelId}-${Date.now()}`;

    const poLineItems = approvedItems.map((item, index) => ({
      description: `${item.reoType} - ${item.barSize || ""} ${item.barShape || ""} - ${item.description || ""}`.trim(),
      quantity: String(item.quantity),
      unitPrice: "0",
      lineTotal: "0",
      sortOrder: index,
    }));

    const po = await storage.createPurchaseOrder({
      companyId,
      poNumber,
      supplierId,
      requestedById: userId,
      status: "DRAFT",
      notes: notes || `Reo schedule for panel ${schedule.panel?.panelMark || schedule.panelId}`,
    }, poLineItems);

    await storage.linkReoScheduleItemsToPO(approvedItems.map(i => i.id), po.id);

    res.status(201).json({
      message: "Purchase order created successfully",
      purchaseOrder: po,
      itemsLinked: approvedItems.length,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Error creating PO from reo schedule");
    res.status(500).json({ message: "Failed to create purchase order" });
  }
});

export { router as reoScheduleRouter };
