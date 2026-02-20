import logger from "./logger";

type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING";

interface Job<T = unknown> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  priority: number;
}

type JobHandler<T = unknown> = (data: T) => Promise<void>;

interface QueueOptions {
  name: string;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxQueueSize?: number;
}

export class JobQueue {
  private queue: Job[] = [];
  private handlers: Map<string, JobHandler<any>> = new Map();
  private running = 0;
  private readonly name: string;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly maxQueueSize: number;
  private processed = 0;
  private failed = 0;
  private isProcessing = false;

  constructor(options: QueueOptions) {
    this.name = options.name;
    this.concurrency = options.concurrency || 3;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 5000;
    this.maxQueueSize = options.maxQueueSize || 10000;
  }

  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler<any>);
    logger.info({ queue: this.name, jobType: type }, "Job handler registered");
  }

  enqueue<T>(type: string, data: T, priority: number = 0): string {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type: ${type}`);
    }
    if (this.queue.length >= this.maxQueueSize) {
      logger.error({ queue: this.name, size: this.queue.length, jobType: type }, "Job queue is full — rejecting new job");
      throw new Error(`Queue '${this.name}' is full (${this.maxQueueSize} jobs). Cannot enqueue new job.`);
    }

    const id = `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job: Job<T> = {
      id,
      type,
      data,
      status: "PENDING",
      attempts: 0,
      maxAttempts: this.maxRetries,
      createdAt: new Date(),
      priority,
    };

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);

    setImmediate(() => this.processNext());

    return id;
  }

  private async processNext(): Promise<void> {
    if (this.running >= this.concurrency) return;

    const nextJob = this.queue.find(j => j.status === "PENDING");
    if (!nextJob) return;

    nextJob.status = "RUNNING";
    nextJob.startedAt = new Date();
    nextJob.attempts++;
    this.running++;

    const handler = this.handlers.get(nextJob.type);
    if (!handler) {
      nextJob.status = "FAILED";
      nextJob.error = `No handler for type: ${nextJob.type}`;
      this.running--;
      return;
    }

    try {
      await handler(nextJob.data);
      nextJob.status = "COMPLETED";
      nextJob.completedAt = new Date();
      this.processed++;
      logger.debug({ queue: this.name, jobId: nextJob.id, type: nextJob.type }, "Job completed");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      nextJob.error = errMsg;

      if (nextJob.attempts < nextJob.maxAttempts) {
        nextJob.status = "RETRYING";
        logger.warn({ queue: this.name, jobId: nextJob.id, attempts: nextJob.attempts, error: errMsg }, "Job failed — retrying");
        setTimeout(() => {
          nextJob.status = "PENDING";
          this.processNext();
        }, this.retryDelayMs * nextJob.attempts);
      } else {
        nextJob.status = "FAILED";
        this.failed++;
        logger.error({ queue: this.name, jobId: nextJob.id, error: errMsg }, "Job permanently failed");
      }
    } finally {
      this.running--;
      this.cleanup();
      setImmediate(() => this.processNext());
    }
  }

  private cleanup(): void {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const beforeSize = this.queue.length;
    this.queue = this.queue.filter(j => {
      if (j.status === "COMPLETED" && j.completedAt && j.completedAt.getTime() < cutoff) return false;
      if (j.status === "FAILED" && j.createdAt.getTime() < cutoff) return false;
      return true;
    });

    if (this.queue.length > 5000) {
      this.queue = this.queue.filter(j => j.status === "PENDING" || j.status === "RUNNING" || j.status === "RETRYING");
      if (this.queue.length !== beforeSize) {
        logger.warn({ queue: this.name, before: beforeSize, after: this.queue.length }, "Emergency queue cleanup performed");
      }
    }
  }

  getStats() {
    const statusCounts: Record<string, number> = {};
    for (const job of this.queue) {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    }
    return {
      name: this.name,
      queueSize: this.queue.length,
      running: this.running,
      processed: this.processed,
      failed: this.failed,
      statusCounts,
    };
  }

  getJobStatus(id: string): Job | undefined {
    return this.queue.find(j => j.id === id);
  }

  drain(): void {
    this.queue = this.queue.filter(j => j.status === "RUNNING");
    logger.info({ queue: this.name }, "Job queue drained");
  }
}

export const emailQueue = new JobQueue({
  name: "email",
  concurrency: 3,
  maxRetries: 3,
  retryDelayMs: 5000,
  maxQueueSize: 50000,
});

export const aiQueue = new JobQueue({
  name: "ai",
  concurrency: 1,
  maxRetries: 2,
  retryDelayMs: 15000,
});

export const pdfQueue = new JobQueue({
  name: "pdf",
  concurrency: 2,
  maxRetries: 2,
  retryDelayMs: 5000,
});

export function getAllQueueStats() {
  return [emailQueue, aiQueue, pdfQueue].map(q => q.getStats());
}

setInterval(() => {
  for (const queue of [emailQueue, aiQueue, pdfQueue]) {
    const stats = queue.getStats();
    if (stats.queueSize > 100) {
      logger.info({ queue: stats.name, size: stats.queueSize }, "Running periodic queue cleanup");
    }
  }
}, 120000);
