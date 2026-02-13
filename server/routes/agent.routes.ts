import { Router } from "express";
import { storage, sha256Hex } from "../storage";
import { agentIngestSchema } from "@shared/schema";
import { z } from "zod";
import logger from "../lib/logger";

const router = Router();

router.post("/ingest", async (req, res) => {
  try {
    const rawKey = req.headers["x-device-key"] as string;
    if (!rawKey) {
      return res.status(401).json({ error: "Missing device key" });
    }

    const deviceKeyHash = sha256Hex(rawKey);
    const device = await storage.getDeviceByApiKey(deviceKeyHash);
    if (!device) {
      return res.status(401).json({ error: "Invalid device key" });
    }

    const parsed = agentIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    }

    const body = parsed.data;

    await storage.updateDevice(device.id, {
      lastSeenAt: new Date(),
      deviceName: body.deviceName,
      os: body.os,
      agentVersion: body.agentVersion || undefined,
    });

    const createdOrUpdated: string[] = [];
    const rules = await storage.getMappingRules(device.user.companyId);

    for (const b of body.blocks) {
      if (b.userEmail.toLowerCase() !== device.user.email.toLowerCase()) continue;

      const dailyLog = await storage.upsertDailyLog({
        userId: device.user.id,
        logDay: b.logDay,
        tz: body.tz,
      });

      let mappedJobId: string | null = null;
      if (!b.jobId && b.filePath) {
        const match = rules.find(r => b.filePath!.toLowerCase().includes(r.pathContains.toLowerCase()));
        if (match) mappedJobId = match.jobId;
      }

      await storage.upsertLogRow(b.sourceEventId, {
        dailyLogId: dailyLog.id,
        jobId: b.jobId || mappedJobId || undefined,
        startAt: new Date(b.startedAt),
        endAt: new Date(b.endedAt),
        durationMin: b.durationMin,
        idleMin: b.idleMin,
        source: b.source || "agent",
        tz: body.tz,
        app: b.app,
        filePath: b.filePath || undefined,
        fileName: b.fileName || undefined,
        revitViewName: b.revit?.viewName || undefined,
        revitSheetNumber: b.revit?.sheetNumber || undefined,
        revitSheetName: b.revit?.sheetName || undefined,
        acadLayoutName: b.acad?.layoutName || undefined,
        rawPanelMark: b.rawPanelMark || undefined,
        rawDrawingCode: b.rawDrawingCode || undefined,
        panelMark: b.rawPanelMark || undefined,
        drawingCode: b.rawDrawingCode || undefined,
      });

      createdOrUpdated.push(b.sourceEventId);
    }

    res.json({ ok: true, count: createdOrUpdated.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Agent ingest error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export const agentRouter = router;
