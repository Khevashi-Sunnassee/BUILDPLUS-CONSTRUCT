import logger from "./logger";

type JobFn = () => Promise<void>;

interface ScheduledJob {
  name: string;
  fn: JobFn;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
  initialTimer: ReturnType<typeof setTimeout> | null;
  isRunning: boolean;
  lastRun: Date | null;
  lastError: string | null;
  lastDurationMs: number | null;
  runCount: number;
  errorCount: number;
}

class BackgroundScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private started = false;

  register(name: string, fn: JobFn, intervalMs: number): void {
    if (this.jobs.has(name)) {
      logger.warn({ job: name }, "[Scheduler] Job already registered, skipping");
      return;
    }
    this.jobs.set(name, {
      name,
      fn,
      intervalMs,
      timer: null,
      initialTimer: null,
      isRunning: false,
      lastRun: null,
      lastError: null,
      lastDurationMs: null,
      runCount: 0,
      errorCount: 0,
    });
    logger.info({ job: name, intervalMs }, "[Scheduler] Job registered");
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    for (const [name, job] of this.jobs) {
      const initialDelay = Math.floor(Math.random() * 10000) + 5000;
      job.initialTimer = setTimeout(() => {
        job.initialTimer = null;
        this.runJob(job);
        job.timer = setInterval(() => this.runJob(job), job.intervalMs);
      }, initialDelay);
      logger.info({ job: name, intervalMs: job.intervalMs, initialDelayMs: initialDelay }, "[Scheduler] Job scheduled");
    }
  }

  stop(): void {
    this.started = false;
    for (const [, job] of this.jobs) {
      if (job.initialTimer) {
        clearTimeout(job.initialTimer);
        job.initialTimer = null;
      }
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = null;
      }
    }
    logger.info("[Scheduler] All jobs stopped");
  }

  async triggerNow(name: string): Promise<boolean> {
    const job = this.jobs.get(name);
    if (!job) return false;
    if (job.isRunning) return false;
    this.runJob(job);
    return true;
  }

  isJobRunning(name: string): boolean {
    return this.jobs.get(name)?.isRunning || false;
  }

  getStatus(): Record<string, {
    isRunning: boolean;
    lastRun: Date | null;
    lastError: string | null;
    lastDurationMs: number | null;
    runCount: number;
    errorCount: number;
    intervalMs: number;
    nextRunEstimate: Date | null;
  }> {
    const status: any = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        isRunning: job.isRunning,
        lastRun: job.lastRun,
        lastError: job.lastError,
        lastDurationMs: job.lastDurationMs,
        runCount: job.runCount,
        errorCount: job.errorCount,
        intervalMs: job.intervalMs,
        nextRunEstimate: job.lastRun ? new Date(job.lastRun.getTime() + job.intervalMs) : null,
      };
    }
    return status;
  }

  private async runJob(job: ScheduledJob): Promise<void> {
    if (job.isRunning) {
      logger.debug({ job: job.name }, "[Scheduler] Job already running, skipping");
      return;
    }

    job.isRunning = true;
    const startTime = Date.now();

    try {
      await job.fn();
      job.lastError = null;
      job.runCount++;
      logger.debug({ job: job.name, durationMs: Date.now() - startTime }, "[Scheduler] Job completed");
    } catch (err: any) {
      job.lastError = err.message || "Unknown error";
      job.errorCount++;
      logger.error({ err, job: job.name }, "[Scheduler] Job failed");
    } finally {
      job.isRunning = false;
      job.lastRun = new Date();
      job.lastDurationMs = Date.now() - startTime;
    }
  }
}

export const scheduler = new BackgroundScheduler();
