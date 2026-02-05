import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { documentRegisterService } from "../services/document-register.service";

const router = Router();
const objectStorageService = new ObjectStorageService();

let ifcDocumentTypeId: string | null = null;
async function getIfcDocumentTypeId(): Promise<string> {
  if (ifcDocumentTypeId) return ifcDocumentTypeId;
  ifcDocumentTypeId = await documentRegisterService.getDocumentTypeIdByPrefix("IFC");
  if (!ifcDocumentTypeId) {
    logger.error("IFC document type not found in database (prefix: IFC)");
    throw new Error("Document type 'IFC' not configured in database");
  }
  return ifcDocumentTypeId;
}

router.post("/api/panels/admin/:id/upload-pdf", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pdfBase64, fileName } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ error: "PDF data is required" });
    }

    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }

    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const pdfFileName = fileName || `${panel.panelMark}_IFC.pdf`;
    const typeId = await getIfcDocumentTypeId();

    const registeredDoc = await documentRegisterService.registerDocument({
      file: {
        buffer: pdfBuffer,
        originalname: pdfFileName,
        mimetype: "application/pdf",
        size: pdfBuffer.length,
      },
      uploadedBy: req.session.userId!,
      source: "PANEL_IFC",
      title: `IFC: ${panel.panelMark}`,
      typeId,
      jobId: panel.jobId,
      panelId: id as string,
      status: "APPROVED",
    });

    await storage.updatePanelRegisterItem(id as string, {
      productionPdfUrl: registeredDoc.storageKey,
    });

    res.json({
      success: true,
      objectPath: registeredDoc.storageKey,
      fileName: pdfFileName,
      documentId: registeredDoc.id,
    });
  } catch (error: any) {
    logger.error({ err: error }, "PDF upload error");
    res.status(500).json({
      error: "Failed to upload PDF",
      details: error.message,
    });
  }
});

router.get("/api/panels/admin/:id/download-pdf", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }

    if (!panel.productionPdfUrl) {
      return res.status(404).json({ error: "No PDF attached to this panel" });
    }

    const objectFile = await objectStorageService.getObjectEntityFile(panel.productionPdfUrl);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${panel.panelMark}_IFC.pdf"`);
    
    objectFile.createReadStream().pipe(res);
  } catch (error: any) {
    logger.error({ err: error }, "PDF download error");
    res.status(500).json({
      error: "Failed to download PDF",
      details: error.message,
    });
  }
});

router.post("/api/panels/admin/:id/analyze-pdf", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
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
      logger.error("Failed to parse OpenAI response");
      extractedData = {};
    }
    
    res.json({
      success: true,
      extracted: extractedData,
      panelId: id,
    });
  } catch (error: any) {
    logger.error({ err: error }, "PDF analysis error");
    res.status(500).json({ 
      error: "Failed to analyze PDF", 
      details: error.message 
    });
  }
});

router.post("/api/panels/admin/:id/approve-production", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
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
    logger.error({ err: error }, "Approval error");
    res.status(500).json({ error: "Failed to approve panel", details: error.message });
  }
});

router.post("/api/panels/admin/:id/revoke-production", requireRole("ADMIN", "MANAGER"), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const panel = await storage.getPanelById(id as string);
    if (!panel) {
      return res.status(404).json({ error: "Panel not found" });
    }
    
    const updated = await storage.revokePanelProductionApproval(id as string);
    
    res.json({ success: true, panel: updated });
  } catch (error: any) {
    logger.error({ err: error }, "Revoke error");
    res.status(500).json({ error: "Failed to revoke approval", details: error.message });
  }
});

export const panelApprovalRouter = router;
