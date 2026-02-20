import { db } from "../../db";
import logger from "../../lib/logger";
import { ObjectStorageService } from "../../replit_integrations/object_storage";
import { apInvoiceActivity } from "@shared/schema";
import { getResendApiKey } from "../../services/email.service";

export const objectStorageService = new ObjectStorageService();

export async function logActivity(invoiceId: string, activityType: string, message: string, actorUserId?: string, metaJson?: any) {
  await db.insert(apInvoiceActivity).values({
    invoiceId,
    activityType,
    message,
    actorUserId: actorUserId || null,
    metaJson: metaJson || null,
  });
}

export { db, logger, getResendApiKey };
