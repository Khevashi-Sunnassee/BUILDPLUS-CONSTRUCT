import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "../../storage";
import { requireAuth } from "../middleware/auth.middleware";
import logger from "../../lib/logger";
import { safeJsonParse } from "../../lib/api-utils";
import { objectStorageService, drawingPackageUpload } from "./shared";

const router = Router();

// ============================================================================
// Drawing Package Processor
// ============================================================================

function compareRevisions(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const pMatch = (s: string) => s.match(/^P(\d+)$/i);
  const pA = pMatch(a);
  const pB = pMatch(b);
  if (pA && pB) return parseInt(pA[1]) - parseInt(pB[1]);
  const revMatch = (s: string) => s.match(/^(?:REV\s*)?([A-Z])$/i);
  const rA = revMatch(a);
  const rB = revMatch(b);
  if (rA && rB) return rA[1].charCodeAt(0) - rB[1].charCodeAt(0);
  return a.localeCompare(b);
}

router.post("/api/documents/drawing-package/analyze", requireAuth, drawingPackageUpload.single("file"), async (req: Request, res: Response) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendProgress = (phase: string, current: number, total: number, detail?: string) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    try { res.write(`data: ${JSON.stringify({ type: "progress", phase, current, total, percent, detail })}\n\n`); } catch {}
  };

  try {
    const file = req.file;
    if (!file) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No PDF file provided" })}\n\n`);
      res.end();
      return;
    }

    sendProgress("pdf_extract", 0, 1, "Extracting pages from PDF...");

    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { spawn } = await import("child_process");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drawing-pkg-"));
    const inputPath = path.join(tempDir, "input.pdf");
    fs.writeFileSync(inputPath, file.buffer);

    const pythonScript = `
import fitz
import json
import re
import sys
import os
import base64

pdf_path = sys.argv[1]
doc = fitz.open(pdf_path)
pages = []

def extract_field(text, patterns, default=""):
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return default

def find_drawing_number(txt):
    lines = txt.split("\\n")
    bad_words = {"REV", "REVISION", "SCALE", "DATE", "DRAWN", "TITLE", "CLIENT", "PROJECT", "COVER", "PAGE", "SHEET", "OF", "NO", "NUMBER", "DWG", "DRAWING", "DESCRIPTION"}
    for idx, line in enumerate(lines):
        upper = line.strip().upper()
        if "DRAWING" in upper and ("NO" in upper or "NUM" in upper or "#" in upper):
            for offset in range(1, 6):
                if idx + offset < len(lines):
                    candidate = lines[idx + offset].strip()
                    if candidate and candidate.upper() not in bad_words and len(candidate) >= 2:
                        clean = re.sub(r'\\s+', ' ', candidate).strip()
                        if re.match(r'^[A-Z0-9]', clean, re.IGNORECASE) and not clean.upper().startswith("REV"):
                            return clean
            break
    patterns = [
        r'\\b([A-Z]{1,4}\\d{1,3}[.]\\d{1,4})\\b',
        r'\\b(\\d{2,3}[\\-][A-Z]{1,4}[\\-]\\d{2,5})\\b',
        r'([A-Z]{2,6}[\\-_][A-Z]{2,6}[\\-_]\\d{3,6})',
        r'([A-Z]{2,}[\\-_]\\d{4,})',
    ]
    for p in patterns:
        m = re.search(p, txt, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if val.upper() not in bad_words:
                return val
    return ""

def make_thumbnail(page_obj, max_dim=1200):
    try:
        rect = page_obj.rect
        w, h = rect.width, rect.height
        scale = min(max_dim / max(w, h), 2.0)
        scale = max(scale, 0.5)
        mat = fitz.Matrix(scale, scale)
        pix = page_obj.get_pixmap(matrix=mat)
        return base64.b64encode(pix.tobytes("png")).decode("ascii")
    except:
        return ""

for i in range(len(doc)):
    page = doc[i]
    text = page.get_text("text")
    
    drawing_number = find_drawing_number(text)
    
    title = extract_field(text, [
        r'(?:TITLE|DESCRIPTION)[:\\s]+([A-Z][A-Z\\s\\-0-9]+(?:PLAN|VIEW|SECTION|ELEVATION|DETAIL|ARRANGEMENT|LAYOUT|SCHEDULE))',
        r'((?:GENERAL\\s+ARRANGEMENT|FLOOR\\s+PLAN|SITE\\s+PLAN|ROOF\\s+PLAN|ELEVATION|SECTION|DETAIL|LAYOUT)[\\sA-Z0-9\\-]*)',
    ])
    
    revision = extract_field(text, [
        r'(?:REV|REVISION)[\\s.:\\-]*([A-Z0-9]{1,4})',
        r'\\b(P\\d{1,3})\\b',
        r'\\b(Rev\\s*[A-Z0-9]{1,3})\\b',
    ])
    
    scale = extract_field(text, [
        r'(?:SCALE)[:\\s]*(1\\s*:\\s*\\d+)',
        r'(1\\s*:\\s*\\d{2,4})',
    ])
    
    project_name = extract_field(text, [
        r'(?:CLIENT|EMPLOYER)[:\\s]+([A-Za-z][A-Za-z\\s&.,]+)',
        r'(?:PROJECT|JOB|SITE)[:\\s]+([A-Za-z][A-Za-z\\s&.,0-9]+)',
    ])
    
    project_number = extract_field(text, [
        r'(?:PROJECT|JOB)\\s*(?:NO|NUMBER|#|NUM)[.:\\s]*(\\d{3,}[A-Z0-9\\-]*)',
    ])
    
    discipline = ""
    if drawing_number:
        dn_upper = drawing_number.upper()
        if "ARCH" in dn_upper: discipline = "Architecture"
        elif "STRUC" in dn_upper or "STR" in dn_upper: discipline = "Structural"
        elif "MECH" in dn_upper or "MEC" in dn_upper: discipline = "Mechanical"
        elif "ELEC" in dn_upper or "ELE" in dn_upper: discipline = "Electrical"
        elif "CIVIL" in dn_upper or "CIV" in dn_upper: discipline = "Civil"
        elif "PLUMB" in dn_upper or "HYD" in dn_upper: discipline = "Hydraulic"
    
    level = extract_field(text, [
        r'(?:LEVEL|LVL|FLOOR)\\s*(\\d+)',
        r'\\bL(\\d{1,2})\\b',
    ])
    
    client = extract_field(text, [
        r'(?:CLIENT|EMPLOYER)[:\\s]+([A-Za-z][A-Za-z\\s&.,]+)',
    ])
    
    date = extract_field(text, [
        r'(?:DATE|DATED)[:\\s]*(\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4})',
        r'(\\d{1,2}[/.]\\d{1,2}[/.]\\d{4})',
    ])
    
    version = extract_field(text, [
        r'(?:VERSION|VER)[.:\\s]*(\\d+\\.?\\d*)',
        r'\\bV(\\d+\\.?\\d*)\\b',
    ])
    if not version:
        version = "1.0"

    thumbnail = make_thumbnail(page)

    pages.append({
        "pageNumber": i + 1,
        "drawingNumber": drawing_number,
        "title": title if title else f"Page {i+1}",
        "revision": revision,
        "version": version,
        "scale": scale,
        "projectName": project_name,
        "projectNumber": project_number,
        "discipline": discipline,
        "level": level,
        "client": client,
        "date": date,
        "textPreview": text[:300].replace("\\n", " ").strip(),
        "thumbnail": thumbnail,
    })

doc.close()
print(json.dumps({"totalPages": len(pages), "pages": pages}))
`;

    logger.info({ filename: file.originalname, fileSize: file.size }, "Starting drawing package analysis");

    const result: string = await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const proc = spawn("python3", ["-c", pythonScript, inputPath], { timeout: 120000 });
      proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
      proc.on("close", (code: number | null) => {
        if (code === 0) {
          logger.info({ outputLength: output.length }, "Drawing package analysis completed");
          resolve(output);
        } else {
          logger.error({ code, errorOutput }, "Drawing package Python analysis failed");
          reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
        }
      });
      proc.on("error", (err: Error) => {
        logger.error({ err }, "Drawing package Python process error");
        reject(err);
      });
    });

    const analysisParseResult = safeJsonParse(result);
    if (!analysisParseResult.success) throw new Error("Failed to parse PDF extraction result");
    const analysisResult: any = analysisParseResult.data;
    sendProgress("pdf_extract", 1, 1, `Extracted ${analysisResult.pages?.length || 0} pages`);

    const aiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (aiApiKey && analysisResult.pages && analysisResult.pages.length > 0) {
      logger.info({ pageCount: analysisResult.pages.length }, "Starting OpenAI vision analysis for drawing metadata");

      const aiClient = new OpenAI({
        apiKey: aiApiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
      });

      const analyzePageWithAI = async (page: any): Promise<any> => {
        if (!page.thumbnail) return page;
        try {
          const completion = await aiClient.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 500,
            messages: [
              {
                role: "system",
                content: `You are an expert construction drawing analyst. Extract metadata from the title block of this engineering/architectural drawing page. Return ONLY valid JSON with these fields:
{
  "drawingNumber": "the unique drawing/sheet number identifier (e.g. S-101, AR-200, DWG-001, 12345-STR-001)",
  "title": "the drawing title or description",
  "revision": "revision letter or number (e.g. A, B, C, P1, P2, 01)",
  "scale": "drawing scale (e.g. 1:100, 1:50, NTS)",
  "projectName": "project or job name",
  "projectNumber": "project or job number",
  "discipline": "discipline like Architecture, Structural, Mechanical, Electrical, Civil, Hydraulic",
  "client": "client or employer name",
  "date": "date shown on drawing",
  "level": "floor or level number if shown"
}
CRITICAL RULES:
- drawingNumber is the UNIQUE IDENTIFIER for this drawing sheet, often found labeled as "Drawing No", "Dwg No", "Sheet No", or similar in the title block. It typically contains a mix of letters, numbers, and dashes (e.g. S-101, AR-200, DWG-001, 12345-STR-001).
- drawingNumber is NEVER the scale (like 1:100), NEVER the revision (like A, B, Rev C), NEVER just a page number (like 1, 2, 3), and NEVER a date.
- If you cannot confidently identify the drawing number, set it to "".
- Leave any field as empty string "" if not clearly visible or identifiable.`
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extract the drawing metadata from this engineering drawing page. Focus on the title block area (usually bottom-right corner) to find the drawing number, title, revision, and other metadata." },
                  { type: "image_url", image_url: { url: `data:image/png;base64,${page.thumbnail}`, detail: "high" } },
                ],
              },
            ],
          });

          const aiText = completion.choices[0]?.message?.content || "";
          const jsonMatch = aiText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let aiData: any;
            try {
              aiData = JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
              logger.warn({ pageNumber: page.pageNumber, rawResponse: aiText.substring(0, 200) }, "Failed to parse AI JSON response");
              return page;
            }

            if (aiData.drawingNumber && /^[0-9:]+$/.test(aiData.drawingNumber.replace(/\s/g, ""))) {
              logger.warn({ pageNumber: page.pageNumber, suspectedScale: aiData.drawingNumber }, "AI returned what looks like a scale, not a drawing number - discarding");
              aiData.drawingNumber = "";
            }

            logger.info({ pageNumber: page.pageNumber, aiDrawingNumber: aiData.drawingNumber, regexDrawingNumber: page.drawingNumber }, "AI vs regex drawing number comparison");

            if (aiData.drawingNumber && aiData.drawingNumber.trim()) page.drawingNumber = aiData.drawingNumber.trim();
            if (aiData.title && aiData.title.trim()) page.title = aiData.title.trim();
            if (aiData.revision && aiData.revision.trim()) page.revision = aiData.revision.trim();
            if (aiData.scale && aiData.scale.trim()) page.scale = aiData.scale.trim();
            if (aiData.projectName && aiData.projectName.trim()) page.projectName = aiData.projectName.trim();
            if (aiData.projectNumber && aiData.projectNumber.trim()) page.projectNumber = aiData.projectNumber.trim();
            if (aiData.discipline && aiData.discipline.trim()) page.discipline = aiData.discipline.trim();
            if (aiData.client && aiData.client.trim()) page.client = aiData.client.trim();
            if (aiData.date && aiData.date.trim()) page.date = aiData.date.trim();
            if (aiData.level && aiData.level.trim()) page.level = aiData.level.trim();
          }
        } catch (aiErr: any) {
          logger.warn({ pageNumber: page.pageNumber, error: aiErr.message }, "OpenAI vision analysis failed for page, using regex fallback");
        }
        return page;
      };

      sendProgress("ai_analysis", 0, analysisResult.pages.length, "Starting AI analysis...");

      const CONCURRENCY = 10;
      const pages = analysisResult.pages;
      let completedPages = 0;
      for (let i = 0; i < pages.length; i += CONCURRENCY) {
        const batch = pages.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (page: any) => {
          const result = await analyzePageWithAI(page);
          completedPages++;
          sendProgress("ai_analysis", completedPages, pages.length, `Analyzing page ${completedPages} of ${pages.length}`);
          return result;
        }));
        for (let j = 0; j < results.length; j++) {
          pages[i + j] = results[j];
        }
      }
      analysisResult.pages = pages;
      logger.info("OpenAI vision analysis complete for all pages");
    }

    sendProgress("matching", 0, 1, "Matching jobs and checking conflicts...");

    const allJobs = await storage.getAllJobs(req.companyId!);
    const jobs = allJobs;
    let matchedJobId: string | null = null;
    let matchedJobName: string | null = null;
    const projectName = analysisResult.pages[0]?.projectName || "";
    const projectNumber = analysisResult.pages[0]?.projectNumber || "";

    if (projectName || projectNumber) {
      let bestScore = 0;
      for (const job of jobs) {
        let score = 0;
        const jobName = (job.name || "").toLowerCase();
        const jobNum = (job.jobNumber || "").toLowerCase();
        const pName = projectName.toLowerCase();
        const pNum = projectNumber.toLowerCase();

        if (pNum && jobNum && jobNum === pNum) score += 100;
        if (pName && jobName && jobName === pName) score += 100;
        if (pName && jobName && jobName.includes(pName)) score += 50;
        if (pName && jobName) {
          const words = pName.split(/\s+/).filter((w: string) => w.length > 2);
          const matches = words.filter((w: string) => jobName.includes(w)).length;
          score += matches * 20;
        }

        if (score > bestScore) {
          bestScore = score;
          matchedJobId = job.id;
          matchedJobName = `${job.jobNumber} - ${job.name}`;
        }
      }
      if (bestScore < 30) {
        matchedJobId = null;
        matchedJobName = null;
      }
    }

    const drawingNumbers = analysisResult.pages
      .map((p: any) => p.drawingNumber)
      .filter((n: string) => n);

    let existingDocuments: any[] = [];
    if (drawingNumbers.length > 0) {
      const docsResult = await storage.getDocuments({ companyId: req.companyId, limit: 10000 });
      existingDocuments = docsResult.documents.filter((d: any) =>
        d.documentNumber && drawingNumbers.includes(d.documentNumber)
      );
    }

    const pagesWithConflicts = analysisResult.pages.map((page: any) => {
      const existing = existingDocuments.filter(
        (d: any) => d.documentNumber === page.drawingNumber
      );
      let conflictAction = "none";
      let conflictDocument: any = null;

      if (existing.length > 0) {
        const latestExisting = existing.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        conflictDocument = {
          id: latestExisting.id,
          title: latestExisting.title,
          revision: latestExisting.revision || "",
          version: latestExisting.version || "1.0",
        };

        const newRev = (page.revision || "").toUpperCase();
        const oldRev = (latestExisting.revision || "").toUpperCase();

        if (newRev === oldRev) {
          conflictAction = "skip";
        } else if (compareRevisions(newRev, oldRev) > 0) {
          conflictAction = "supersede";
        } else {
          conflictAction = "keep_both";
        }
      }

      return { ...page, conflictAction, conflictDocument };
    });

    try { fs.unlinkSync(inputPath); fs.rmdirSync(tempDir); } catch {}

    sendProgress("matching", 1, 1, "Complete");

    const finalResult = {
      totalPages: analysisResult.totalPages,
      pages: pagesWithConflicts,
      matchedJob: matchedJobId ? { id: matchedJobId, name: matchedJobName } : null,
      jobs: jobs.map((j: any) => ({ id: j.id, name: `${j.jobNumber} - ${j.name}` })),
      originalFileName: file.originalname,
    };

    res.write(`data: ${JSON.stringify({ type: "result", data: finalResult })}\n\n`);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error analyzing drawing package");
    try {
      res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Failed to analyze drawing package" })}\n\n`);
      res.end();
    } catch {}
  }
});

router.post("/api/documents/drawing-package/register", requireAuth, drawingPackageUpload.single("file"), async (req: Request, res: Response) => {
  req.setTimeout(600000);
  res.setTimeout(600000);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendProgress = (phase: string, current: number, total: number, detail?: string) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    try { res.write(`data: ${JSON.stringify({ type: "progress", phase, current, total, percent, detail })}\n\n`); } catch {}
  };

  try {
    const file = req.file;
    if (!file) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No PDF file provided" })}\n\n`);
      res.end();
      return;
    }

    const drawingsParseResult = safeJsonParse<any[]>(req.body.drawings || "[]", []);
    const drawingsData: any[] = drawingsParseResult.success ? drawingsParseResult.data : [];
    const globalJobId = req.body.jobId || null;

    if (!drawingsData.length) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "No drawings to register" })}\n\n`);
      res.end();
      return;
    }

    sendProgress("splitting", 0, drawingsData.length, "Splitting PDF into individual pages...");

    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const { spawn } = await import("child_process");

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "drawing-split-"));
    const inputPath = path.join(tempDir, "input.pdf");
    fs.writeFileSync(inputPath, file.buffer);

    const splitScript = `
import fitz
import os
import json
import sys

pdf_path = sys.argv[1]
output_dir = sys.argv[2]
doc = fitz.open(pdf_path)
extracted = []

os.makedirs(output_dir, exist_ok=True)

for page_num in range(len(doc)):
    new_doc = fitz.open()
    new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
    filename = f"drawing_{page_num + 1}.pdf"
    filepath = os.path.join(output_dir, filename)
    new_doc.save(filepath)
    new_doc.close()
    extracted.append({"filename": filename, "filepath": filepath, "pageNumber": page_num + 1})

doc.close()
print(json.dumps(extracted))
`;

    const outputDir = path.join(tempDir, "pages");
    const splitResult: string = await new Promise((resolve, reject) => {
      let output = "";
      let errorOutput = "";
      const proc = spawn("python3", ["-c", splitScript, inputPath, outputDir], { timeout: 120000 });
      proc.stdout.on("data", (data: Buffer) => { output += data.toString(); });
      proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString(); });
      proc.on("close", (code: number | null) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Split failed: ${errorOutput}`));
      });
      proc.on("error", (err: Error) => reject(err));
    });

    const splitParseResult = safeJsonParse<Array<{ filename: string; filepath: string; pageNumber: number }>>(splitResult);
    if (!splitParseResult.success) throw new Error("Failed to parse PDF split result");
    const extractedFiles = splitParseResult.data;

    sendProgress("splitting", drawingsData.length, drawingsData.length, "PDF split complete");

    const results: any[] = [];
    let processedCount = 0;
    const totalToProcess = drawingsData.length;

    for (const drawing of drawingsData) {
      processedCount++;

      if (drawing.action === "skip") {
        results.push({ pageNumber: drawing.pageNumber, status: "skipped", drawingNumber: drawing.drawingNumber });
        sendProgress("registering", processedCount, totalToProcess, `Skipped ${drawing.drawingNumber || `page ${drawing.pageNumber}`}`);
        continue;
      }

      sendProgress("registering", processedCount, totalToProcess, `Uploading ${drawing.drawingNumber || `page ${drawing.pageNumber}`}...`);

      const pageFile = extractedFiles.find((f) => f.pageNumber === drawing.pageNumber);
      if (!pageFile) {
        results.push({ pageNumber: drawing.pageNumber, status: "error", error: "Page file not found" });
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(pageFile.filepath);
        const timestamp = Date.now();
        const safeDrawingNum = (drawing.drawingNumber || `page_${drawing.pageNumber}`).replace(/[^a-zA-Z0-9_\-]/g, "_");
        const storedFileName = `${safeDrawingNum}_${timestamp}.pdf`;

        const storagePath = `documents/${storedFileName}`;
        await objectStorageService.uploadFile(storagePath, fileBuffer, "application/pdf");

        const tags: string[] = [];
        if (drawing.revision) tags.push(`Rev ${drawing.revision}`);
        if (drawing.scale) tags.push(`Scale ${drawing.scale}`);
        if (drawing.level) tags.push(`Level ${drawing.level}`);
        if (drawing.drawingNumber) tags.push(drawing.drawingNumber);

        let supersedeDocId: string | null = null;
        if (drawing.action === "supersede" && drawing.conflictDocumentId) {
          supersedeDocId = drawing.conflictDocumentId;
          await storage.updateDocument(supersedeDocId as string, {
            status: "SUPERSEDED",
            isLatestVersion: false,
          });
        }

        const doc = await storage.createDocument({
          companyId: req.companyId!,
          title: drawing.title || `Drawing ${drawing.pageNumber}`,
          documentNumber: drawing.drawingNumber || null,
          revision: drawing.revision || "A",
          version: supersedeDocId ? "2.0" : (drawing.version || "1.0"),
          fileName: storedFileName,
          originalName: `${drawing.drawingNumber || `page_${drawing.pageNumber}`}.pdf`,
          storageKey: storagePath,
          fileSize: fileBuffer.length,
          mimeType: "application/pdf",
          status: "DRAFT",
          isLatestVersion: true,
          jobId: drawing.jobId || globalJobId || null,
          tags: tags.join(", "),
          uploadedBy: req.session.userId!,
          typeId: drawing.typeId || null,
          disciplineId: drawing.disciplineId || null,
          categoryId: drawing.categoryId || null,
        });

        results.push({
          pageNumber: drawing.pageNumber,
          status: "registered",
          documentId: doc.id,
          drawingNumber: drawing.drawingNumber,
          title: drawing.title,
        });
      } catch (err: unknown) {
        logger.error({ err, pageNumber: drawing.pageNumber }, "Error registering drawing page");
        results.push({ pageNumber: drawing.pageNumber, status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }

    try {
      const cleanupFiles = (dir: string) => {
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            if (fs.statSync(fp).isDirectory()) cleanupFiles(fp);
            else fs.unlinkSync(fp);
          }
          fs.rmdirSync(dir);
        }
      };
      cleanupFiles(tempDir);
    } catch {}

    const registered = results.filter((r) => r.status === "registered").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    res.write(`data: ${JSON.stringify({ type: "result", data: { success: true, summary: { total: drawingsData.length, registered, skipped, errors }, results } })}\n\n`);
    res.end();
  } catch (error: unknown) {
    logger.error({ err: error }, "Error registering drawing package");
    try {
      res.write(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Failed to register drawing package" })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
