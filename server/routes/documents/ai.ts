import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { openai, upload, bulkUpload } from "./shared";

const router = Router();

// ============================================================================
// Visual Diff / Overlay Comparison
// ============================================================================

const visualDiffSchema = z.object({
  docId1: z.string().min(1),
  docId2: z.string().min(1),
  page: z.number().int().min(0).default(0),
  dpi: z.number().int().min(72).max(300).default(150),
  sensitivity: z.number().int().min(1).max(255).default(30),
  mode: z.enum(["overlay", "side-by-side", "both"]).default("overlay"),
});

router.post("/api/documents/visual-diff", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = visualDiffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parameters", details: parsed.error.flatten() });
    }

    const userId = req.session.userId;
    const companyId = req.companyId;
    if (!userId || !companyId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { generateVisualDiff } = await import("../../services/visual-diff.service");

    const result = await generateVisualDiff({
      ...parsed.data,
      uploadedBy: userId,
      companyId,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error({ err: error }, "Visual diff endpoint error");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate visual diff" });
  }
});

// ==================== AI DOCUMENT ANALYSIS ====================

router.post("/api/documents/analyze-version", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const originalDocumentId = req.body.originalDocumentId;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!originalDocumentId) {
      return res.status(400).json({ error: "Original document ID required" });
    }

    const originalDocument = await storage.getDocument(originalDocumentId);
    if (!originalDocument) {
      return res.status(404).json({ error: "Original document not found" });
    }

    const newFileName = file.originalname;
    const originalFileName = originalDocument.originalName;
    const newFileSize = file.size;
    const originalFileSize = originalDocument.fileSize || 0;
    const mimeType = file.mimetype;

    let prompt = `You are analyzing a document version update. Compare the new version to the original and provide a brief, professional summary of what likely changed.

Original Document:
- Title: ${originalDocument.title}
- File Name: ${originalFileName}
- File Size: ${originalFileSize} bytes
- Type: ${originalDocument.type?.typeName || 'Unknown'}
- Discipline: ${originalDocument.discipline?.disciplineName || 'Unknown'}

New Version:
- File Name: ${newFileName}
- File Size: ${newFileSize} bytes
- Size Change: ${newFileSize > originalFileSize ? `+${newFileSize - originalFileSize}` : newFileSize - originalFileSize} bytes

Based on the file information and typical document workflows, provide a concise 1-2 sentence summary of what likely changed. Focus on professional, construction/engineering document terminology where appropriate. Examples: "Updated drawing with revised dimensions", "Incorporated client feedback on specifications", "Minor text corrections and formatting updates".`;

    if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
      prompt += `\n\nNote: This is a ${mimeType} file. Consider typical changes for this document type.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a document management assistant that provides brief, professional summaries of document changes. Keep responses concise and relevant to construction/engineering workflows."
        },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 150,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";

    logger.info({ originalDocumentId, newFileName }, "AI version analysis completed");
    res.json({ summary });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing document version with AI");
    res.status(500).json({ error: "Failed to analyze document", summary: "" });
  }
});

router.post("/api/documents/:id/analyze-changes", requireAuth, async (req: Request, res: Response) => {
  try {
    const documentId = String(req.params.id);
    const doc = await storage.getDocument(documentId);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!doc.parentDocumentId) {
      return res.status(400).json({ error: "This is the original version - no previous version to compare against" });
    }

    const parentDoc = await storage.getDocument(doc.parentDocumentId);
    if (!parentDoc) {
      return res.status(404).json({ error: "Parent document not found" });
    }

    let prompt = `You are analyzing a document version update in a construction/engineering document management system. Compare the new version to the original and provide a brief, professional summary of what likely changed.

Original Document (Previous Version):
- Title: ${parentDoc.title}
- File Name: ${parentDoc.originalName}
- File Size: ${parentDoc.fileSize || 0} bytes
- Version: ${parentDoc.version}${parentDoc.revision || ''}
- Status: ${parentDoc.status}
- Type: ${parentDoc.type?.typeName || 'Unknown'}
- Discipline: ${parentDoc.discipline?.disciplineName || 'Unknown'}

New Document (Current Version):
- Title: ${doc.title}
- File Name: ${doc.originalName}
- File Size: ${doc.fileSize || 0} bytes
- Version: ${doc.version}${doc.revision || ''}
- Status: ${doc.status}
- Size Change: ${(doc.fileSize || 0) > (parentDoc.fileSize || 0) ? `+${(doc.fileSize || 0) - (parentDoc.fileSize || 0)}` : (doc.fileSize || 0) - (parentDoc.fileSize || 0)} bytes

Based on the file information, version numbers, and typical construction/engineering document workflows, provide a concise 2-3 sentence summary of what likely changed between v${parentDoc.version}${parentDoc.revision || ''} and v${doc.version}${doc.revision || ''}. Focus on professional, construction/engineering document terminology. Consider common reasons for version updates such as design revisions, client feedback, RFI responses, specification changes, or coordination updates.`;

    const mimeType = doc.mimeType || '';
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      prompt += `\n\nNote: This is a ${mimeType} file (likely a drawing or specification document). Consider typical changes for this document type in construction projects.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a document management assistant for construction and engineering projects. Provide brief, professional summaries of document version changes. Keep responses concise (2-3 sentences) and relevant to construction/engineering workflows."
        },
        { role: "user", content: prompt }
      ],
      max_completion_tokens: 200,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";

    if (summary) {
      await storage.updateDocument(documentId, { changeSummary: summary });
    }

    logger.info({ documentId, parentId: doc.parentDocumentId }, "AI version change analysis completed");
    res.json({ summary });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing document version changes");
    res.status(500).json({ error: "Failed to analyze document changes", summary: "" });
  }
});

// ==================== AI FILE METADATA EXTRACTION ====================

router.post("/api/documents/extract-metadata", requireAuth, bulkUpload.array("files", 50), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        try {
          let fileContentHint = "";

          if (file.mimetype === "application/pdf") {
            const textChunk = file.buffer.toString("utf-8", 0, Math.min(file.buffer.length, 4000));
            const printable = textChunk.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
            if (printable.length > 50) {
              fileContentHint = `\nExtracted text from PDF (partial): "${printable.substring(0, 2000)}"`;
            }
          } else if (
            file.mimetype.startsWith("text/") ||
            file.mimetype === "application/json" ||
            file.mimetype === "application/xml" ||
            file.mimetype === "application/rtf"
          ) {
            const textContent = file.buffer.toString("utf-8", 0, Math.min(file.buffer.length, 3000));
            fileContentHint = `\nFile text content (partial): "${textContent.substring(0, 2000)}"`;
          }

          const prompt = `You are a document management assistant for a construction/precast manufacturing company. Analyze this file and extract metadata.

File name: "${file.originalname}"
File type: ${file.mimetype}
File size: ${file.size} bytes
${fileContentHint}

Extract the following information from the file name and any available content. Use construction/engineering document naming conventions:

1. **Title**: A clean, professional document title. Remove file extensions, prefixes like rev/version numbers. If the filename contains a meaningful title, use it. Otherwise generate one based on the content/filename.
2. **Document Number**: Look for patterns like "DOC-001", "DWG-A-001", "XX-YYY-NNN", alphanumeric codes at the start of filenames, or any structured numbering. Return empty string if none found.
3. **Revision**: Look for revision indicators like "Rev A", "R1", "RevB", "-A", "v2", etc. in the filename or content. Return empty string if none found.
4. **Version**: A numeric version like "1.0", "2.0". Default to "1.0" if not identifiable.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"title": "...", "documentNumber": "...", "revision": "...", "version": "1.0"}`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a metadata extraction assistant. Always respond with valid JSON only, no markdown formatting or code blocks."
              },
              { role: "user", content: prompt }
            ],
            max_completion_tokens: 200,
          });

          const rawResponse = completion.choices[0]?.message?.content?.trim() || "";
          const jsonStr = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          try {
            const parsed = JSON.parse(jsonStr);
            return {
              fileName: file.originalname,
              title: parsed.title || file.originalname.replace(/\.[^/.]+$/, ""),
              documentNumber: parsed.documentNumber || "",
              revision: parsed.revision || "",
              version: parsed.version || "1.0",
              success: true,
            };
          } catch {
            return {
              fileName: file.originalname,
              title: file.originalname.replace(/\.[^/.]+$/, ""),
              documentNumber: "",
              revision: "",
              version: "1.0",
              success: false,
            };
          }
        } catch (aiError) {
          logger.warn({ err: aiError, fileName: file.originalname }, "AI metadata extraction failed for file");
          return {
            fileName: file.originalname,
            title: file.originalname.replace(/\.[^/.]+$/, ""),
            documentNumber: "",
            revision: "",
            version: "1.0",
            success: false,
          };
        }
      })
    );

    res.json({ results });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error extracting metadata from files");
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to extract metadata" });
  }
});

export default router;
