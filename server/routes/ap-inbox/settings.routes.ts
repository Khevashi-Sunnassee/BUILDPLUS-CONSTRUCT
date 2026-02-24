import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { db, logger } from "./shared";
import { eq } from "drizzle-orm";
import { apInboxSettings, companies } from "@shared/schema";

export function registerSettingsRoutes(router: Router) {
  router.get("/api/ap-inbox/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const [settings] = await db.select().from(apInboxSettings)
        .where(eq(apInboxSettings.companyId, companyId)).limit(1);

      const [company] = await db.select({ apInboxEmail: companies.apInboxEmail })
        .from(companies).where(eq(companies.id, companyId)).limit(1);
      const centralEmail = company?.apInboxEmail || null;

      if (!settings) {
        return res.json({
          companyId,
          isEnabled: false,
          inboundEmailAddress: centralEmail,
          autoExtract: true,
          autoSubmit: false,
          defaultStatus: "IMPORTED",
          notifyUserIds: [],
        });
      }

      res.json({ ...settings, inboundEmailAddress: centralEmail || settings.inboundEmailAddress });
    } catch (error: unknown) {
      logger.error({ err: error }, "Error fetching inbox settings");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });

  router.put("/api/ap-inbox/settings", requireAuth, async (req: Request, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) return res.status(400).json({ error: "Company context required" });

      const { inboundEmailAddress: _ignored, ...body } = z.object({
        isEnabled: z.boolean().optional(),
        inboundEmailAddress: z.string().nullable().optional(),
        autoExtract: z.boolean().optional(),
        autoSubmit: z.boolean().optional(),
        defaultStatus: z.enum(["IMPORTED", "PROCESSED"]).optional(),
        notifyUserIds: z.array(z.string()).optional(),
      }).parse(req.body);

      const [existing] = await db.select().from(apInboxSettings)
        .where(eq(apInboxSettings.companyId, companyId)).limit(1);

      let settings;
      if (existing) {
        [settings] = await db.update(apInboxSettings)
          .set({ ...body, updatedAt: new Date() })
          .where(eq(apInboxSettings.companyId, companyId))
          .returning();
      } else {
        [settings] = await db.insert(apInboxSettings)
          .values({ companyId, ...body })
          .returning();
      }

      res.json(settings);
    } catch (error: unknown) {
      logger.error({ err: error }, "Error updating inbox settings");
      res.status(500).json({ error: "An internal error occurred" });
    }
  });
}
