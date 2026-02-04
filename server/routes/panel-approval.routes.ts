import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { requireRole } from "./middleware/auth.middleware";

const router = Router();

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
    console.error("Approval error:", error);
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
    console.error("Revoke error:", error);
    res.status(500).json({ error: "Failed to revoke approval", details: error.message });
  }
});

export const panelApprovalRouter = router;
