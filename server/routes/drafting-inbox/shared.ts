import multer from "multer";
import { ObjectStorageService } from "../../replit_integrations/object_storage";
import { db } from "../../db";
import { draftingEmailActivity } from "@shared/schema";

export const objectStorageService = new ObjectStorageService();

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function logDraftingEmailActivity(
  inboundEmailId: string,
  activityType: string,
  message: string,
  actorUserId?: string,
  metaJson?: any
) {
  await db.insert(draftingEmailActivity).values({
    inboundEmailId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}
