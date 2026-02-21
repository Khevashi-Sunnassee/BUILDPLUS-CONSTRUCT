import { Router } from "express";
import { db } from "../db";
import { timerSessions, timerEvents, logRows, dailyLogs, jobs, panelRegister, workTypes } from "@shared/schema";
import { requireAuth } from "./middleware/auth.middleware";
import { eq, and, desc, or } from "drizzle-orm";
import { format } from "date-fns";
import logger from "../lib/logger";
import { logPanelChange } from "../services/panel-audit.service";
import { z } from "zod";

/**
 * Timer state machine: RUNNING → PAUSED → RUNNING → … → COMPLETED | CANCELLED
 * Valid transitions:
 *   START  → RUNNING (only if no active/paused session exists for user)
 *   PAUSE  → PAUSED  (only from RUNNING; snapshots elapsed time into totalElapsedMs)
 *   RESUME → RUNNING (only from PAUSED; resets startedAt, preserves totalElapsedMs)
 *   STOP   → COMPLETED (from RUNNING or PAUSED; creates a logRow time entry)
 *   CANCEL → CANCELLED (from RUNNING or PAUSED; discards without creating a log)
 *
 * Time accumulation: totalElapsedMs stores cumulative work time across pause/resume
 * cycles. On resume, startedAt resets to "now" so the next pause/stop can compute
 * the delta (now - startedAt) and add it to totalElapsedMs. Idle time (breaks) is
 * calculated as wall-clock duration minus totalElapsedMs on stop.
 */
const timerStartSchema = z.object({
  jobId: z.string().nullable().optional(),
  panelRegisterId: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  app: z.string().nullable().optional(),
  dailyLogId: z.string().nullable().optional(),
});

const timerStopSchema = z.object({
  jobId: z.string().nullable().optional(),
  panelRegisterId: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  app: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  panelMark: z.string().nullable().optional(),
  drawingCode: z.string().nullable().optional(),
});

const timerUpdateSchema = z.object({
  jobId: z.string().nullable().optional(),
  panelRegisterId: z.string().nullable().optional(),
  workTypeId: z.string().nullable().optional(),
  app: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Helper function to record timer events
async function recordTimerEvent(
  timerSessionId: string,
  userId: string,
  eventType: "START" | "PAUSE" | "RESUME" | "STOP" | "CANCEL",
  elapsedMsAtEvent: number,
  notes?: string
) {
  try {
    await db.insert(timerEvents).values({
      timerSessionId,
      userId,
      eventType,
      elapsedMsAtEvent,
      notes: notes || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, `Failed to record timer event: ${eventType}`);
  }
}

const router = Router();

// Get all timer sessions for current user
router.get("/api/timer-sessions", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessions = await db
      .select({
        id: timerSessions.id,
        userId: timerSessions.userId,
        dailyLogId: timerSessions.dailyLogId,
        jobId: timerSessions.jobId,
        panelRegisterId: timerSessions.panelRegisterId,
        workTypeId: timerSessions.workTypeId,
        app: timerSessions.app,
        status: timerSessions.status,
        startedAt: timerSessions.startedAt,
        pausedAt: timerSessions.pausedAt,
        completedAt: timerSessions.completedAt,
        totalElapsedMs: timerSessions.totalElapsedMs,
        pauseCount: timerSessions.pauseCount,
        notes: timerSessions.notes,
        logRowId: timerSessions.logRowId,
        createdAt: timerSessions.createdAt,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
        panelMark: panelRegister.panelMark,
        workTypeName: workTypes.name,
      })
      .from(timerSessions)
      .leftJoin(jobs, eq(timerSessions.jobId, jobs.id))
      .leftJoin(panelRegister, eq(timerSessions.panelRegisterId, panelRegister.id))
      .leftJoin(workTypes, eq(timerSessions.workTypeId, workTypes.id))
      .where(eq(timerSessions.userId, userId))
      .orderBy(desc(timerSessions.startedAt))
      .limit(50);

    res.json(sessions);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching timer sessions");
    res.status(500).json({ error: "Failed to fetch timer sessions" });
  }
});

// Get active timer session for current user
router.get("/api/timer-sessions/active", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const [activeSession] = await db
      .select({
        id: timerSessions.id,
        userId: timerSessions.userId,
        dailyLogId: timerSessions.dailyLogId,
        jobId: timerSessions.jobId,
        panelRegisterId: timerSessions.panelRegisterId,
        workTypeId: timerSessions.workTypeId,
        app: timerSessions.app,
        status: timerSessions.status,
        startedAt: timerSessions.startedAt,
        pausedAt: timerSessions.pausedAt,
        completedAt: timerSessions.completedAt,
        totalElapsedMs: timerSessions.totalElapsedMs,
        pauseCount: timerSessions.pauseCount,
        notes: timerSessions.notes,
        logRowId: timerSessions.logRowId,
        createdAt: timerSessions.createdAt,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
        panelMark: panelRegister.panelMark,
        workTypeName: workTypes.name,
      })
      .from(timerSessions)
      .leftJoin(jobs, eq(timerSessions.jobId, jobs.id))
      .leftJoin(panelRegister, eq(timerSessions.panelRegisterId, panelRegister.id))
      .leftJoin(workTypes, eq(timerSessions.workTypeId, workTypes.id))
      .where(and(
        eq(timerSessions.userId, userId),
        eq(timerSessions.status, "RUNNING")
      ))
      .limit(1);

    // Also check for paused sessions
    if (!activeSession) {
      const [pausedSession] = await db
        .select({
          id: timerSessions.id,
          userId: timerSessions.userId,
          dailyLogId: timerSessions.dailyLogId,
          jobId: timerSessions.jobId,
          panelRegisterId: timerSessions.panelRegisterId,
          workTypeId: timerSessions.workTypeId,
          app: timerSessions.app,
          status: timerSessions.status,
          startedAt: timerSessions.startedAt,
          pausedAt: timerSessions.pausedAt,
          completedAt: timerSessions.completedAt,
          totalElapsedMs: timerSessions.totalElapsedMs,
          pauseCount: timerSessions.pauseCount,
          notes: timerSessions.notes,
          logRowId: timerSessions.logRowId,
          createdAt: timerSessions.createdAt,
          jobNumber: jobs.jobNumber,
          jobName: jobs.name,
          panelMark: panelRegister.panelMark,
          workTypeName: workTypes.name,
        })
        .from(timerSessions)
        .leftJoin(jobs, eq(timerSessions.jobId, jobs.id))
        .leftJoin(panelRegister, eq(timerSessions.panelRegisterId, panelRegister.id))
        .leftJoin(workTypes, eq(timerSessions.workTypeId, workTypes.id))
        .where(and(
          eq(timerSessions.userId, userId),
          eq(timerSessions.status, "PAUSED")
        ))
        .limit(1);

      res.json(pausedSession || null);
      return;
    }

    res.json(activeSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching active timer session");
    res.status(500).json({ error: "Failed to fetch active timer session" });
  }
});

// Start a new timer session
router.post("/api/timer-sessions/start", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const result = timerStartSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { jobId, panelRegisterId, workTypeId, app, dailyLogId } = result.data;
    const companyId = req.companyId as string;

    if (jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) return res.status(404).json({ error: "Job not found" });
    }
    if (panelRegisterId) {
      const [panel] = await db.select({ id: panelRegister.id }).from(panelRegister)
        .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
        .where(and(eq(panelRegister.id, panelRegisterId), eq(jobs.companyId, companyId))).limit(1);
      if (!panel) return res.status(404).json({ error: "Panel not found" });
    }

    // Check if there's already an active or paused session
    const [existingSession] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.userId, userId),
        or(
          eq(timerSessions.status, "RUNNING"),
          eq(timerSessions.status, "PAUSED")
        )
      ))
      .limit(1);

    if (existingSession) {
      const message = existingSession.status === "PAUSED" 
        ? "You have a paused timer. Please resume or cancel it first."
        : "You already have an active timer running";
      return res.status(400).json({ error: message });
    }

    const now = new Date();
    const [newSession] = await db
      .insert(timerSessions)
      .values({
        userId,
        dailyLogId: dailyLogId || null,
        jobId: jobId || null,
        panelRegisterId: panelRegisterId || null,
        workTypeId: workTypeId ? parseInt(workTypeId, 10) : null,
        app: app || null,
        status: "RUNNING",
        startedAt: now,
        totalElapsedMs: 0 as number,
        pauseCount: 0 as number,
      })
      .returning();

    // Record START event
    await recordTimerEvent(newSession.id, userId, "START", 0);

    // Log to panel audit if panel is linked
    if (newSession.panelRegisterId) {
      logPanelChange(newSession.panelRegisterId, "TIMER_START", userId, {
        changedFields: { timerSessionId: newSession.id, jobId: newSession.jobId },
      });
    }

    logger.info(`Timer session started: ${newSession.id} for user: ${userId}`);
    res.json(newSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error starting timer session");
    res.status(500).json({ error: "Failed to start timer session" });
  }
});

// Pause a timer session
router.post("/api/timer-sessions/:id/pause", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessionId = req.params.id as string;

    const [session] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.id, sessionId),
        eq(timerSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Timer session not found" });
    }

    if (session.status !== "RUNNING") {
      return res.status(400).json({ error: "Timer is not running" });
    }

    const now = new Date();
    const elapsedSinceStart = now.getTime() - session.startedAt.getTime();
    const newTotalElapsed = session.totalElapsedMs + elapsedSinceStart;

    const [updatedSession] = await db
      .update(timerSessions)
      .set({
        status: "PAUSED",
        pausedAt: now,
        totalElapsedMs: newTotalElapsed,
        pauseCount: session.pauseCount + 1,
        updatedAt: now,
      })
      .where(eq(timerSessions.id, sessionId))
      .returning();

    // Record PAUSE event
    await recordTimerEvent(sessionId, userId, "PAUSE", newTotalElapsed);

    // Log to panel audit if panel is linked
    if (session.panelRegisterId) {
      logPanelChange(session.panelRegisterId, "TIMER_PAUSE", userId, {
        changedFields: { timerSessionId: sessionId, totalElapsedMs: newTotalElapsed, pauseCount: session.pauseCount + 1 },
      });
    }

    logger.info(`Timer session paused: ${sessionId}, totalElapsedMs: ${newTotalElapsed}`);
    res.json(updatedSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error pausing timer session");
    res.status(500).json({ error: "Failed to pause timer session" });
  }
});

// Resume a paused timer session
router.post("/api/timer-sessions/:id/resume", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessionId = req.params.id as string;

    const [session] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.id, sessionId),
        eq(timerSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Timer session not found" });
    }

    if (session.status !== "PAUSED") {
      return res.status(400).json({ error: "Timer is not paused" });
    }

    const now = new Date();

    const [updatedSession] = await db
      .update(timerSessions)
      .set({
        status: "RUNNING",
        startedAt: now, // Reset start time to now, elapsed time is preserved in totalElapsedMs
        pausedAt: null,
        updatedAt: now,
      })
      .where(eq(timerSessions.id, sessionId))
      .returning();

    // Record RESUME event
    await recordTimerEvent(sessionId, userId, "RESUME", session.totalElapsedMs);

    // Log to panel audit if panel is linked
    if (session.panelRegisterId) {
      logPanelChange(session.panelRegisterId, "TIMER_RESUME", userId, {
        changedFields: { timerSessionId: sessionId, totalElapsedMs: session.totalElapsedMs },
      });
    }

    logger.info(`Timer session resumed: ${sessionId}`);
    res.json(updatedSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error resuming timer session");
    res.status(500).json({ error: "Failed to resume timer session" });
  }
});

// Stop a timer session and create a log entry
router.post("/api/timer-sessions/:id/stop", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessionId = req.params.id as string;
    const result = timerStopSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { jobId, panelRegisterId, workTypeId, app, notes, panelMark, drawingCode } = result.data;
    const companyId = req.companyId as string;

    if (jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) return res.status(404).json({ error: "Job not found" });
    }
    if (panelRegisterId) {
      const [panel] = await db.select({ id: panelRegister.id }).from(panelRegister)
        .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
        .where(and(eq(panelRegister.id, panelRegisterId), eq(jobs.companyId, companyId))).limit(1);
      if (!panel) return res.status(404).json({ error: "Panel not found" });
    }

    const [session] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.id, sessionId),
        eq(timerSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Timer session not found" });
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return res.status(400).json({ error: "Timer session is already completed or cancelled" });
    }

    const now = new Date();
    let totalElapsed = session.totalElapsedMs;

    /**
     * If RUNNING, the current segment (startedAt→now) hasn't been captured yet.
     * If PAUSED, totalElapsedMs already includes all work time up to the last pause.
     */
    if (session.status === "RUNNING") {
      totalElapsed += now.getTime() - session.startedAt.getTime();
    }

    const durationMinutes = Math.round(totalElapsed / 60000);

    /**
     * Daily logs are bucketed by Melbourne (AEDT) date, not UTC, so a session
     * stopped at 11pm UTC still lands on the correct Australian business day.
     */
    const melbourneOffset = 11 * 60 * 60 * 1000; // AEDT offset
    const melbourneNow = new Date(now.getTime() + melbourneOffset);
    const logDay = format(melbourneNow, "yyyy-MM-dd");

    let [dailyLog] = await db
      .select()
      .from(dailyLogs)
      .where(and(
        eq(dailyLogs.userId, userId),
        eq(dailyLogs.logDay, logDay)
      ))
      .limit(1);

    if (!dailyLog) {
      // Create daily log
      [dailyLog] = await db
        .insert(dailyLogs)
        .values({
          userId,
          logDay,
          factory: "MELBOURNE",
          status: "PENDING",
        })
        .returning();
    }

    /**
     * startAt/endAt on the logRow represent the wall-clock span of the session.
     * createdAt is used (not startedAt) because startedAt resets on each resume.
     * endAt uses pausedAt when stopped from PAUSED, since that's when work actually ceased.
     * idleMin = (endAt - startAt) - totalElapsed, capturing break/pause gaps.
     */
    const sessionStartTime = session.createdAt;
    const sessionEndTime = session.status === "PAUSED" && session.pausedAt ? session.pausedAt : now;

    // Get panel mark and drawing code from panel register if panelRegisterId is provided
    const finalPanelRegisterId = panelRegisterId || session.panelRegisterId || null;
    let finalPanelMark = panelMark || null;
    let finalDrawingCode = drawingCode || null;

    if (finalPanelRegisterId && (!finalPanelMark || !finalDrawingCode)) {
      const [panel] = await db
        .select({
          panelMark: panelRegister.panelMark,
          drawingCode: panelRegister.drawingCode,
        })
        .from(panelRegister)
        .where(eq(panelRegister.id, finalPanelRegisterId))
        .limit(1);

      if (panel) {
        if (!finalPanelMark) finalPanelMark = panel.panelMark;
        if (!finalDrawingCode) finalDrawingCode = panel.drawingCode || null;
      }
    }

    // Create log row entry
    const [logRow] = await db
      .insert(logRows)
      .values({
        dailyLogId: dailyLog.id,
        jobId: jobId || session.jobId || null,
        panelRegisterId: finalPanelRegisterId,
        workTypeId: workTypeId ? parseInt(workTypeId, 10) : (session.workTypeId || null),
        startAt: sessionStartTime,
        endAt: sessionEndTime,
        durationMin: Math.round(durationMinutes) as number,
        idleMin: Math.max(0, Math.round((sessionEndTime.getTime() - sessionStartTime.getTime() - totalElapsed) / 60000)) as number,
        source: "timer",
        sourceEventId: `timer-${sessionId}`,
        app: app || session.app || "manual",
        panelMark: finalPanelMark,
        drawingCode: finalDrawingCode,
        notes: notes || session.notes || null,
        isUserEdited: true,
      })
      .returning();

    // Update timer session
    const [updatedSession] = await db
      .update(timerSessions)
      .set({
        status: "COMPLETED",
        completedAt: now,
        totalElapsedMs: totalElapsed as number,
        logRowId: logRow.id,
        dailyLogId: dailyLog.id,
        jobId: jobId || session.jobId,
        panelRegisterId: panelRegisterId || session.panelRegisterId,
        workTypeId: workTypeId ? parseInt(workTypeId, 10) : (session.workTypeId || null),
        app: app || session.app,
        notes: notes || session.notes,
        updatedAt: now,
      })
      .where(eq(timerSessions.id, sessionId))
      .returning();

    // Record STOP event
    await recordTimerEvent(sessionId, userId, "STOP", totalElapsed, notes || undefined);

    // Log to panel audit if panel is linked
    const finalPanelId = panelRegisterId || session.panelRegisterId;
    if (finalPanelId) {
      logPanelChange(finalPanelId, "TIMER_STOP", userId, {
        changedFields: { timerSessionId: sessionId, totalElapsedMs: totalElapsed, durationMinutes, logRowId: logRow.id },
      });
    }

    logger.info(`Timer session stopped: ${sessionId}, logRowId: ${logRow.id}, durationMinutes: ${durationMinutes}`);

    res.json({ session: updatedSession, logRow });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error stopping timer session");
    res.status(500).json({ error: "Failed to stop timer session" });
  }
});

/**
 * Auto-cancels abandoned timer sessions from previous days (Melbourne timezone).
 * Called when the timer UI loads to prevent stale RUNNING/PAUSED sessions from
 * blocking new timers. Today's sessions are preserved. Each cancelled session
 * gets a CANCEL event logged with its computed elapsed time.
 */
router.post("/api/timer-sessions/cancel-stale", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;

    const staleSessions = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.userId, userId),
        or(
          eq(timerSessions.status, "RUNNING"),
          eq(timerSessions.status, "PAUSED")
        )
      ))
      .limit(500);

    const now = new Date();
    const melbourneOffset = 11 * 60 * 60 * 1000;
    const melbourneNow = new Date(now.getTime() + melbourneOffset);
    const todayStr = format(melbourneNow, "yyyy-MM-dd");
    let cancelledCount = 0;

    for (const session of staleSessions) {
      const sessionMelbourneTime = new Date(session.startedAt.getTime() + melbourneOffset);
      const sessionDateStr = format(sessionMelbourneTime, "yyyy-MM-dd");
      
      if (sessionDateStr === todayStr) {
        continue;
      }

      let elapsedAtCancel = session.totalElapsedMs;
      if (session.status === "RUNNING") {
        elapsedAtCancel += now.getTime() - session.startedAt.getTime();
      }

      await db
        .update(timerSessions)
        .set({
          status: "CANCELLED",
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(timerSessions.id, session.id));

      await recordTimerEvent(session.id, userId, "CANCEL", elapsedAtCancel, "Auto-cancelled: stale session from previous day");
      cancelledCount++;
    }

    if (cancelledCount > 0) {
      logger.info(`Auto-cancelled ${cancelledCount} stale timer session(s) for user: ${userId}`);
    }

    res.json({ cancelledCount });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error cancelling stale timer sessions");
    res.status(500).json({ error: "Failed to cancel stale timer sessions" });
  }
});

// Cancel a timer session without creating a log entry
router.post("/api/timer-sessions/:id/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessionId = req.params.id as string;

    const [session] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.id, sessionId),
        eq(timerSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Timer session not found" });
    }

    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      return res.status(400).json({ error: "Timer session is already completed or cancelled" });
    }

    const now = new Date();

    const [updatedSession] = await db
      .update(timerSessions)
      .set({
        status: "CANCELLED",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(timerSessions.id, sessionId))
      .returning();

    // Record CANCEL event - calculate elapsed time
    let elapsedAtCancel = session.totalElapsedMs;
    if (session.status === "RUNNING") {
      elapsedAtCancel += now.getTime() - session.startedAt.getTime();
    }
    await recordTimerEvent(sessionId, userId, "CANCEL", elapsedAtCancel);

    // Log to panel audit if panel is linked
    if (session.panelRegisterId) {
      logPanelChange(session.panelRegisterId, "TIMER_CANCEL", userId, {
        changedFields: { timerSessionId: sessionId, totalElapsedMs: elapsedAtCancel },
      });
    }

    logger.info(`Timer session cancelled: ${sessionId}`);
    res.json(updatedSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error cancelling timer session");
    res.status(500).json({ error: "Failed to cancel timer session" });
  }
});

// Update timer session metadata (job, panel, etc.)
router.patch("/api/timer-sessions/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const sessionId = req.params.id as string;
    const result = timerUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.format() });
    }
    const { jobId, panelRegisterId, workTypeId, app, notes } = result.data;
    const companyId = req.companyId as string;

    if (jobId) {
      const [job] = await db.select({ id: jobs.id }).from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId))).limit(1);
      if (!job) return res.status(404).json({ error: "Job not found" });
    }
    if (panelRegisterId) {
      const [panel] = await db.select({ id: panelRegister.id }).from(panelRegister)
        .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
        .where(and(eq(panelRegister.id, panelRegisterId), eq(jobs.companyId, companyId))).limit(1);
      if (!panel) return res.status(404).json({ error: "Panel not found" });
    }

    const [session] = await db
      .select()
      .from(timerSessions)
      .where(and(
        eq(timerSessions.id, sessionId),
        eq(timerSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Timer session not found" });
    }

    const [updatedSession] = await db
      .update(timerSessions)
      .set({
        jobId: jobId !== undefined ? jobId : session.jobId,
        panelRegisterId: panelRegisterId !== undefined ? panelRegisterId : session.panelRegisterId,
        workTypeId: workTypeId !== undefined ? (workTypeId ? parseInt(workTypeId, 10) : null) : session.workTypeId,
        app: app !== undefined ? app : session.app,
        notes: notes !== undefined ? notes : session.notes,
        updatedAt: new Date(),
      })
      .where(eq(timerSessions.id, sessionId))
      .returning();

    res.json(updatedSession);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error updating timer session");
    res.status(500).json({ error: "Failed to update timer session" });
  }
});

// Get total elapsed time and history for a specific panel
router.get("/api/timer-sessions/panel/:panelId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const panelId = req.params.panelId as string;

    // Get all completed timer sessions for this panel
    const sessions = await db
      .select({
        id: timerSessions.id,
        status: timerSessions.status,
        startedAt: timerSessions.startedAt,
        completedAt: timerSessions.completedAt,
        totalElapsedMs: timerSessions.totalElapsedMs,
        pauseCount: timerSessions.pauseCount,
        notes: timerSessions.notes,
        jobNumber: jobs.jobNumber,
        jobName: jobs.name,
        panelMark: panelRegister.panelMark,
        workTypeName: workTypes.name,
      })
      .from(timerSessions)
      .leftJoin(jobs, eq(timerSessions.jobId, jobs.id))
      .leftJoin(panelRegister, eq(timerSessions.panelRegisterId, panelRegister.id))
      .leftJoin(workTypes, eq(timerSessions.workTypeId, workTypes.id))
      .where(and(
        eq(timerSessions.userId, userId),
        eq(timerSessions.panelRegisterId, panelId),
        eq(timerSessions.status, "COMPLETED")
      ))
      .orderBy(desc(timerSessions.completedAt));

    // Calculate total elapsed time across all sessions
    const totalElapsedMs = sessions.reduce((sum, s) => sum + (s.totalElapsedMs || 0), 0);

    res.json({
      panelId,
      totalElapsedMs,
      sessionCount: sessions.length,
      sessions,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching panel timer history");
    res.status(500).json({ error: "Failed to fetch panel timer history" });
  }
});

export const timerRouter = router;
