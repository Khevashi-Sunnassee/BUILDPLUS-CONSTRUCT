import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import logger from "../lib/logger";
import { ObjectStorageService } from "../replit_integrations/object_storage";
import { documentRegisterService } from "./document-register.service";
import { storage } from "../storage";

const execFileAsync = promisify(execFile);
const objectStorageService = new ObjectStorageService();

const PYTHON_SCRIPT = path.join(process.cwd(), "server", "visual-diff.py");
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
];

export interface VisualDiffOptions {
  docId1: string;
  docId2: string;
  page?: number;
  dpi?: number;
  sensitivity?: number;
  mode?: "overlay" | "side-by-side" | "both";
  uploadedBy: string;
  companyId: string;
}

export interface VisualDiffResult {
  success: boolean;
  overlayDocumentId?: string;
  sideBySideDocumentId?: string;
  changePercentage?: number;
  changedPixels?: number;
  totalPixels?: number;
  pagesDoc1?: number;
  pagesDoc2?: number;
  comparedPage?: number;
  error?: string;
}

async function downloadToTempFile(storageKey: string, extension: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `vdiff_${crypto.randomUUID()}${extension}`);

  const objectFile = await objectStorageService.getObjectEntityFile(storageKey);
  const [buffer] = await objectFile.download();

  await fs.promises.writeFile(tmpPath, buffer);
  return tmpPath;
}

function getMimeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
  };
  return map[mimeType] || ".bin";
}

async function cleanupFiles(...paths: string[]) {
  for (const p of paths) {
    try {
      if (p && fs.existsSync(p)) {
        await fs.promises.unlink(p);
      }
    } catch (e) {
      logger.warn({ path: p, error: e }, "Failed to cleanup temp file");
    }
  }
}

export async function generateVisualDiff(options: VisualDiffOptions): Promise<VisualDiffResult> {
  const {
    docId1,
    docId2,
    page = 0,
    dpi = 150,
    sensitivity = 30,
    mode = "overlay",
    uploadedBy,
    companyId,
  } = options;

  const [doc1, doc2] = await Promise.all([
    storage.getDocument(docId1),
    storage.getDocument(docId2),
  ]);

  if (!doc1 || !doc2) {
    return { success: false, error: "One or both documents not found" };
  }

  if (doc1.companyId !== companyId || doc2.companyId !== companyId) {
    return { success: false, error: "Access denied: documents do not belong to your company" };
  }

  if (!SUPPORTED_MIME_TYPES.includes(doc1.mimeType) || !SUPPORTED_MIME_TYPES.includes(doc2.mimeType)) {
    return {
      success: false,
      error: `Unsupported file type. Both documents must be PDF or image files. Got: ${doc1.mimeType}, ${doc2.mimeType}`,
    };
  }

  const ext1 = getMimeExtension(doc1.mimeType);
  const ext2 = getMimeExtension(doc2.mimeType);
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `vdiff_output_${crypto.randomUUID()}.png`);
  const outputSbsPath = outputPath.replace(".png", "_sbs.png");

  let tmpFile1 = "";
  let tmpFile2 = "";

  try {
    [tmpFile1, tmpFile2] = await Promise.all([
      downloadToTempFile(doc1.storageKey, ext1),
      downloadToTempFile(doc2.storageKey, ext2),
    ]);

    logger.info({
      doc1: { id: docId1, name: doc1.originalName },
      doc2: { id: docId2, name: doc2.originalName },
      page,
      dpi,
      sensitivity,
      mode,
    }, "Starting visual diff");

    const args = [
      PYTHON_SCRIPT,
      tmpFile1,
      tmpFile2,
      outputPath,
      `--dpi=${dpi}`,
      `--sensitivity=${sensitivity}`,
      `--page=${page}`,
      `--mode=${mode}`,
    ];

    const { stdout, stderr } = await execFileAsync("python3", args, {
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      logger.warn({ stderr }, "Python visual diff stderr");
    }

    let pythonResult: any;
    try {
      pythonResult = JSON.parse(stdout.trim());
    } catch (parseError) {
      logger.error({ stdout: stdout.substring(0, 500), stderr }, "Failed to parse Python visual diff output");
      return { success: false, error: "Visual diff engine returned invalid output" };
    }

    if (!pythonResult.success) {
      return { success: false, error: pythonResult.error || "Unknown comparison error" };
    }

    if (!pythonResult.output_files) {
      return { success: false, error: "Visual diff produced no output files" };
    }

    const result: VisualDiffResult = {
      success: true,
      changePercentage: pythonResult.change_percentage,
      changedPixels: pythonResult.changed_pixels,
      totalPixels: pythonResult.total_pixels,
      pagesDoc1: pythonResult.pages_doc1,
      pagesDoc2: pythonResult.pages_doc2,
      comparedPage: pythonResult.compared_page,
    };

    const doc1Name = doc1.originalName.replace(/\.[^/.]+$/, "");
    const doc2Name = doc2.originalName.replace(/\.[^/.]+$/, "");

    if (pythonResult.output_files.overlay && fs.existsSync(outputPath)) {
      const overlayBuffer = await fs.promises.readFile(outputPath);
      const overlayFileName = `Overlay_${doc1Name}_vs_${doc2Name}_p${page + 1}.png`;

      const overlayDoc = await documentRegisterService.registerDocument({
        file: {
          buffer: overlayBuffer,
          originalname: overlayFileName,
          mimetype: "image/png",
          size: overlayBuffer.length,
        },
        uploadedBy,
        companyId,
        source: "MANUAL_UPLOAD",
        title: `Visual Overlay: ${doc1.title} vs ${doc2.title} (Page ${page + 1})`,
        description: `Pixel-level comparison overlay. Red = removed content, Blue = added content. Change: ${pythonResult.change_percentage}%. DPI: ${dpi}, Sensitivity: ${sensitivity}. Compared: "${doc1.originalName}" (Doc A) vs "${doc2.originalName}" (Doc B).`,
        jobId: doc1.jobId || doc2.jobId,
        panelId: doc1.panelId || doc2.panelId,
        tags: "overlay,visual-diff,comparison",
      });

      result.overlayDocumentId = overlayDoc.id;
    }

    if (pythonResult.output_files.side_by_side && fs.existsSync(outputSbsPath)) {
      const sbsBuffer = await fs.promises.readFile(outputSbsPath);
      const sbsFileName = `SideBySide_${doc1Name}_vs_${doc2Name}_p${page + 1}.png`;

      const sbsDoc = await documentRegisterService.registerDocument({
        file: {
          buffer: sbsBuffer,
          originalname: sbsFileName,
          mimetype: "image/png",
          size: sbsBuffer.length,
        },
        uploadedBy,
        companyId,
        source: "MANUAL_UPLOAD",
        title: `Side-by-Side: ${doc1.title} vs ${doc2.title} (Page ${page + 1})`,
        description: `Side-by-side comparison. Left = Original (Doc A), Right = Revised (Doc B) with change borders highlighted. Change: ${pythonResult.change_percentage}%.`,
        jobId: doc1.jobId || doc2.jobId,
        panelId: doc1.panelId || doc2.panelId,
        tags: "side-by-side,visual-diff,comparison",
      });

      result.sideBySideDocumentId = sbsDoc.id;
    }

    logger.info({
      overlayId: result.overlayDocumentId,
      sbsId: result.sideBySideDocumentId,
      changePercentage: result.changePercentage,
    }, "Visual diff completed");

    return result;

  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, "Visual diff failed");
    return { success: false, error: error.message || "Visual diff processing failed" };
  } finally {
    await cleanupFiles(tmpFile1, tmpFile2, outputPath, outputSbsPath);
  }
}
