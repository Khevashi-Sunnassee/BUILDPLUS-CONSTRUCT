import { Router } from "express";
import multer from "multer";
import { db } from "../../db";
import { apInvoiceActivity } from "@shared/schema";
import { ObjectStorageService } from "../../replit_integrations/object_storage";

export const objectStorageService = new ObjectStorageService();

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export async function logActivity(invoiceId: string, type: string, message: string, actorUserId: string, meta?: any) {
  await db.insert(apInvoiceActivity).values({
    invoiceId,
    activityType: type,
    message,
    actorUserId,
    metaJson: meta || null,
  });
}

export interface SharedDeps {
  db: typeof db;
  objectStorageService: ObjectStorageService;
  upload: typeof upload;
  logActivity: typeof logActivity;
}
