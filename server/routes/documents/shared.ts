import multer from "multer";
import crypto from "crypto";
import OpenAI from "openai";
import { storage, db } from "../../storage";
import { eq, and, inArray } from "drizzle-orm";
import { tenderPackages, tenders, documentBundles, documentBundleItems } from "@shared/schema";
import { ObjectStorageService } from "../../replit_integrations/object_storage";
import { Request } from "express";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const objectStorageService = new ObjectStorageService();

function getDocumentLinkSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for document link signing");
  }
  return secret;
}

export const DOCUMENT_LINK_EXPIRY_DAYS = 7;

export function generateDocumentDownloadToken(documentId: string): string {
  const expiresAt = Date.now() + DOCUMENT_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ documentId, expiresAt });
  const hmac = crypto.createHmac("sha256", getDocumentLinkSecret()).update(payload).digest("hex");
  const tokenData = Buffer.from(payload).toString("base64url");
  return `${tokenData}.${hmac}`;
}

export function verifyDocumentDownloadToken(token: string): { documentId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [tokenData, hmac] = parts;
  try {
    const payload = Buffer.from(tokenData, "base64url").toString("utf-8");
    const expectedHmac = crypto.createHmac("sha256", getDocumentLinkSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) return null;
    const parsed = JSON.parse(payload);
    if (!parsed.documentId || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) return null;
    return { documentId: parsed.documentId };
  } catch {
    return null;
  }
}

export function generateBulkDownloadToken(documentIds: string[]): string {
  const expiresAt = Date.now() + DOCUMENT_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ documentIds, expiresAt });
  const hmac = crypto.createHmac("sha256", getDocumentLinkSecret()).update(payload).digest("hex");
  const tokenData = Buffer.from(payload).toString("base64url");
  return `${tokenData}.${hmac}`;
}

export function verifyBulkDownloadToken(token: string): { documentIds: string[] } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [tokenData, hmac] = parts;
  try {
    const payload = Buffer.from(tokenData, "base64url").toString("utf-8");
    const expectedHmac = crypto.createHmac("sha256", getDocumentLinkSecret()).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) return null;
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed.documentIds) || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) return null;
    return { documentIds: parsed.documentIds };
  } catch {
    return null;
  }
}

export function formatFileSizeServer(bytes: number): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function findAffectedOpenTenders(documentId: string, companyId: string) {
  const [directPackages, bundleItems] = await Promise.all([
    db.select({
      tenderId: tenders.id,
      tenderTitle: tenders.title,
      tenderNumber: tenders.tenderNumber,
      tenderStatus: tenders.status,
      packageId: tenderPackages.id,
    })
      .from(tenderPackages)
      .innerJoin(tenders, eq(tenderPackages.tenderId, tenders.id))
      .where(and(
        eq(tenderPackages.documentId, documentId),
        eq(tenderPackages.companyId, companyId),
        inArray(tenders.status, ["DRAFT", "OPEN", "UNDER_REVIEW"]),
      ))
      .limit(1000),
    db.select({ bundleId: documentBundleItems.bundleId })
      .from(documentBundleItems)
      .innerJoin(documentBundles, eq(documentBundleItems.bundleId, documentBundles.id))
      .where(and(eq(documentBundleItems.documentId, documentId), eq(documentBundles.companyId, companyId)))
      .limit(1000),
  ]);

  const bundleIds = bundleItems.map(b => b.bundleId);
  let bundlePackages: typeof directPackages = [];
  if (bundleIds.length > 0) {
    bundlePackages = await db
      .select({
        tenderId: tenders.id,
        tenderTitle: tenders.title,
        tenderNumber: tenders.tenderNumber,
        tenderStatus: tenders.status,
        packageId: tenderPackages.id,
      })
      .from(tenderPackages)
      .innerJoin(tenders, eq(tenderPackages.tenderId, tenders.id))
      .where(and(
        inArray(tenderPackages.bundleId, bundleIds),
        eq(tenderPackages.companyId, companyId),
        inArray(tenders.status, ["DRAFT", "OPEN", "UNDER_REVIEW"]),
      ))
      .limit(1000);
  }

  const allHits = [...directPackages, ...bundlePackages];
  const tenderMap = new Map<string, { tenderId: string; tenderTitle: string; tenderNumber: string; tenderStatus: string; packageIds: string[] }>();
  for (const hit of allHits) {
    const existing = tenderMap.get(hit.tenderId);
    if (existing) {
      if (!existing.packageIds.includes(hit.packageId)) existing.packageIds.push(hit.packageId);
    } else {
      tenderMap.set(hit.tenderId, {
        tenderId: hit.tenderId,
        tenderTitle: hit.tenderTitle,
        tenderNumber: hit.tenderNumber,
        tenderStatus: hit.tenderStatus,
        packageIds: [hit.packageId],
      });
    }
  }
  return Array.from(tenderMap.values());
}

export const THUMBNAIL_WIDTH = 300;
export const THUMBNAIL_MAX_CACHE = 500;
export const thumbnailCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();

export function evictOldestThumbnails() {
  if (thumbnailCache.size <= THUMBNAIL_MAX_CACHE) return;
  const entries = [...thumbnailCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = entries.slice(0, thumbnailCache.size - THUMBNAIL_MAX_CACHE);
  for (const [key] of toRemove) {
    thumbnailCache.delete(key);
  }
}

export function buildContentDisposition(disposition: "attachment" | "inline", originalName: string): string {
  const asciiName = originalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encodedName = encodeURIComponent(originalName).replace(/'/g, '%27');
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/html", "text/xml", "application/json",
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/acad", "application/x-autocad", "image/vnd.dwg", "image/x-dwg",
  "application/dxf", "image/vnd.dxf",
  "application/x-step", "application/ifc",
  "application/rtf", "application/xml",
];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export const drawingPackageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are supported for drawing packages"));
  },
});

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}
