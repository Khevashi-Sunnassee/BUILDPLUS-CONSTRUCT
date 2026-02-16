import logger from "./logger";

export interface PreparedDocument {
  extractedText: string | null;
  imageBuffers: { base64: string; mimeType: string }[];
}

export async function prepareDocumentForExtraction(
  buffer: Buffer,
  mimeType: string | null
): Promise<PreparedDocument> {
  const isPdf = mimeType?.includes("pdf");

  if (!isPdf) {
    return {
      extractedText: null,
      imageBuffers: [{ base64: buffer.toString("base64"), mimeType: mimeType || "image/jpeg" }],
    };
  }

  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ap-extract-"));
  const pdfPath = path.join(tmpDir, "invoice.pdf");
  fs.writeFileSync(pdfPath, buffer);

  let extractedText: string | null = null;
  const imageBuffers: { base64: string; mimeType: string }[] = [];

  try {
    try {
      extractedText = execSync(`pdftotext -layout "${pdfPath}" -`, { timeout: 15000 }).toString("utf-8").trim();
      if (extractedText && extractedText.length < 20) {
        extractedText = null;
      }
    } catch {
      extractedText = null;
    }

    let pageCount = 1;
    try {
      const pagesOutput = execSync(`pdfinfo "${pdfPath}" 2>/dev/null | grep "^Pages:" | awk '{print $2}'`, { timeout: 5000 }).toString().trim();
      pageCount = parseInt(pagesOutput) || 1;
    } catch {
      pageCount = 1;
    }

    if (extractedText && extractedText.length > 100) {
      execSync(`pdftoppm -png -r 200 -f 1 -l 1 "${pdfPath}" "${path.join(tmpDir, 'page')}"`, { timeout: 20000 });

      if (pageCount > 1) {
        execSync(`pdftoppm -png -r 200 -f ${pageCount} -l ${pageCount} "${pdfPath}" "${path.join(tmpDir, 'lastpage')}"`, { timeout: 20000 });
      }
    } else {
      const maxPages = Math.min(pageCount, 2);
      execSync(`pdftoppm -png -r 200 -l ${maxPages} "${pdfPath}" "${path.join(tmpDir, 'page')}"`, { timeout: 30000 });
    }

    const pageFiles = fs.readdirSync(tmpDir)
      .filter((f: string) => (f.startsWith("page") || f.startsWith("lastpage")) && f.endsWith(".png"))
      .sort();

    for (const pageFile of pageFiles) {
      const pageBuffer = fs.readFileSync(path.join(tmpDir, pageFile));
      imageBuffers.push({ base64: pageBuffer.toString("base64"), mimeType: "image/png" });
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  return { extractedText, imageBuffers };
}
