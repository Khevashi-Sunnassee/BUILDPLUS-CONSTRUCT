import crypto from "crypto";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import serveIndex from "serve-index";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase, ensureSystemChecklistModules } from "./seed";
import { seedHelpEntries } from "./seed-help";
import { runMigrations } from "./migrate";
import logger from "./lib/logger";
import { errorMonitor } from "./lib/error-monitor";
import { pool, db } from "./db";
import { getAllCacheStats } from "./lib/cache";
import { getAllCircuitStats } from "./lib/circuit-breaker";
import { getAllQueueStats } from "./lib/job-queue";
import { resendRateLimiter } from "./lib/rate-limiter";
import { requestMetrics, getEventLoopLag } from "./lib/metrics";
import { sanitizeRequestBody, validateContentType, enforceBodyLimits, validateAllParams, sanitizeQueryStrings } from "./middleware/sanitize";
import { requestTimingMiddleware } from "./middleware/request-timing";
import { healthRouter } from "./middleware/health";
import { errorSanitizer, globalErrorHandler } from "./middleware/error-sanitizer";
import { generatePrometheusMetrics } from "./lib/prometheus";

const app = express();

const isDev = process.env.NODE_ENV !== "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isDev
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"]
        : ["'self'", "'unsafe-inline'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: isDev
        ? ["'self'", "ws:", "wss:", "https:"]
        : ["'self'", "wss:", "https://api.openai.com", "https://api.resend.com", "https://api.twilio.com", "https://api.mailgun.net", "https://*.replit.dev", "https://*.replit.app"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isDev ? null : [],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: isDev ? false : { maxAge: 31536000, includeSubDomains: true },
}));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

app.set("trust proxy", 1);

const sessionKeyGenerator = (req: Request & { session?: { id?: string } }): string => {
  const sessionId = req.session?.id;
  if (sessionId) return `session:${sessionId}`;
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip;
  return `ip:${ip || "unknown"}`;
};

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  validate: { xForwardedForHeader: false, ip: false, default: false },
  keyGenerator: sessionKeyGenerator,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again in 15 minutes" },
});

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later" },
});

const kbChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI chat requests, please slow down and try again shortly" },
  validate: { xForwardedForHeader: false, ip: false, default: false },
  keyGenerator: sessionKeyGenerator,
});

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.set('etag', false);

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    if (req.url?.includes('/drawing-package/')) return false;
    const contentType = res.getHeader('Content-Type');
    if (typeof contentType === 'string' && contentType.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

const downloadsPath = path.join(process.cwd(), 'public/downloads');
app.use('/download-files', express.static(downloadsPath), serveIndex(downloadsPath, { icons: true }));

const chatUploadsPath = path.join(process.cwd(), 'uploads', 'chat');
app.use('/uploads/chat', express.static(chatUploadsPath));
const httpServer = createServer(app);
httpServer.timeout = 300000;
httpServer.keepAliveTimeout = 300000;
httpServer.headersTimeout = 310000;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Larger body limit for specific upload/import routes
const largeBodyRoutes = [
  "/api/documents/upload",
  "/api/documents/:id/new-version",
  "/api/panels/:panelId/documents/upload",
  "/api/tasks/:id/files",
  "/api/purchase-orders/:id/attachments",
  "/api/chat/:conversationId/files",
  "/api/procurement/items/import",
  "/api/jobs/:jobId/import-estimate",
  "/api/admin/settings/logo",
  "/api/assets/import"
];
for (const route of largeBodyRoutes) {
  app.use(route, express.json({ limit: "50mb" }));
}

app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

app.use(sanitizeRequestBody);
app.use(validateContentType);
app.use("/api", enforceBodyLimits);
app.use("/api", validateAllParams);
app.use("/api", sanitizeQueryStrings);
app.use(requestTimingMiddleware);
app.use(errorSanitizer);
app.use(healthRouter);

// Request-ID middleware for tracing
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as unknown as Record<string, unknown>).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.use("/api/auth/login", authLimiter);
app.use("/api/documents/upload", uploadLimiter);
app.use("/api/documents/:id/new-version", uploadLimiter);
app.use("/api/panels/:panelId/documents/upload", uploadLimiter);
app.use("/api/tasks/:id/files", uploadLimiter);
app.use("/api/purchase-orders/:id/attachments", uploadLimiter);
app.use("/api/chat/:conversationId/files", uploadLimiter);
app.use("/api/procurement/items/import", uploadLimiter);
app.use("/api/kb/conversations/:id/messages", kbChatLimiter);
app.use("/api/", apiLimiter);

app.use("/api/", (req, res, next) => {
  const timeout = req.path.includes("/reports/") || req.path.includes("/cost-analysis") 
    ? 60000 
    : 30000;
  
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      logger.warn({ path: req.path, method: req.method }, `Request timed out after ${timeout}ms`);
      res.status(408).json({ error: "Request timed out" });
    }
  });
  res.setTimeout(timeout);
  next();
});

export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && (res.statusCode >= 400 || duration > 1000)) {
        const body = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${body.length > 500 ? body.slice(0, 500) + '...' : body}`;
      }

      log(logLine);

      requestMetrics.record(req.method, path, duration, res.statusCode);
    }
  });

  next();
});

let appReady = false;

app.use((req, res, next) => {
  if (appReady) {
    return next();
  }
  if (req.path === "/api/health") {
    return next();
  }
  if (req.path.startsWith("/api/")) {
    return res.status(503).json({ message: "Application is starting, please wait..." });
  }
  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1"><title>BuildPlus Ai - Loading</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}div{text-align:center}h2{margin-bottom:8px}p{opacity:0.7;font-size:14px}.spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #3b82f6;border-radius:50%;margin:0 auto 16px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div><div class="spinner"></div><h2>BuildPlus Ai</h2><p>Application is starting up...</p></div><script>setTimeout(()=>location.reload(),3000)</script></body></html>`);
});

app.get("/api/admin/error-summary", (req, res) => {
  if (!req.session?.userId || (req.session as unknown as Record<string, unknown>).role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  res.json(errorMonitor.getSummary());
});

app.get("/api/health", (req, res) => {
  const isAdmin = (req.session as unknown as Record<string, unknown>)?.role === "ADMIN";

  pool.query("SELECT 1")
    .then(() => {
      const response: Record<string, unknown> = {
        status: "healthy",
        timestamp: new Date().toISOString(),
      };
      if (isAdmin) {
        response.uptime = process.uptime();
        response.memory = process.memoryUsage();
        response.pool = {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        };
        response.cache = getAllCacheStats();
        response.circuitBreakers = getAllCircuitStats();
        response.queues = getAllQueueStats();
        response.system = {
          nodeVersion: process.version,
          processUptime: Math.round(process.uptime()),
          eventLoopLagMs: getEventLoopLag(),
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        };
      }
      res.json(response);
    })
    .catch((err) => {
      logger.error({ err }, "Health check failed — database unreachable");
      res.status(503).json({
        status: "unhealthy",
        error: "Database connection failed",
        timestamp: new Date().toISOString(),
      });
    });
});

app.get("/api/admin/metrics", (req, res) => {
  if (!req.session?.userId || (req.session as unknown as Record<string, unknown>).role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  res.json(requestMetrics.getSummary());
});

app.get("/api/admin/pool-metrics", (req, res) => {
  if (!req.session?.userId || (req.session as unknown as Record<string, unknown>).role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  res.json({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: 100,
    utilization: pool.totalCount > 0 ? ((pool.totalCount - pool.idleCount) / pool.totalCount * 100).toFixed(1) + "%" : "0%",
    activeConnections: pool.totalCount - pool.idleCount,
    cache: getAllCacheStats(),
    circuitBreakers: getAllCircuitStats(),
    queues: getAllQueueStats(),
    rateLimiters: { resend: resendRateLimiter.getStats() },
    eventLoopLagMs: getEventLoopLag(),
    memory: process.memoryUsage(),
    uptime: Math.round(process.uptime()),
  });
});

app.get("/api/metrics/prometheus", async (req, res) => {
  if (!req.session?.userId || (req.session as unknown as Record<string, unknown>).role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  try {
    const metrics = await generatePrometheusMetrics();
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(metrics);
  } catch (err) {
    logger.error({ err }, "Failed to generate Prometheus metrics");
    res.status(500).json({ error: "Failed to generate metrics" });
  }
});

process.on("unhandledRejection", (reason, promise) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  errorMonitor.track(err, { route: "unhandledRejection" });
  logger.error({ reason, promise: String(promise) }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — process will exit");
  gracefulShutdown("uncaughtException");
});

let isShuttingDown = false;
let activeRequests = 0;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (isShuttingDown) {
    res.setHeader("Connection", "close");
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ error: "Server is shutting down" });
    }
  }
  activeRequests++;
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      activeRequests = Math.max(0, activeRequests - 1);
    }
  };
  res.on("finish", decrement);
  res.on("close", decrement);
  next();
});

async function waitForActiveRequests(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (activeRequests > 0 && Date.now() - start < timeoutMs) {
    logger.info({ activeRequests }, "Waiting for in-flight requests to complete");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (activeRequests > 0) {
    logger.warn({ activeRequests }, "Drain timeout reached — proceeding with shutdown");
  }
}

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`Received ${signal} — starting graceful shutdown`);
  
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 20s — forcing exit");
    process.exit(1);
  }, 20000);
  forceExitTimer.unref();

  try {
    const { scheduler } = await import("./lib/background-scheduler");
    scheduler.stop();
    logger.info("Background scheduler stopped");
  } catch (err) {
    logger.error({ err }, "Error stopping background scheduler");
  }

  try {
    const { emailQueue, aiQueue, pdfQueue } = await import("./lib/job-queue");
    const { resendRateLimiter } = await import("./lib/rate-limiter");
    emailQueue.drain();
    aiQueue.drain();
    pdfQueue.drain();
    resendRateLimiter.destroy();
    logger.info("Job queues drained and rate limiters destroyed");
  } catch (err) {
    logger.error({ err }, "Error draining job queues");
  }

  await waitForActiveRequests(5000);
  
  httpServer.close(async () => {
    logger.info("HTTP server closed");
    try {
      await pool.end();
      logger.info("Database pool drained");
    } catch (err) {
      logger.error({ err }, "Error draining database pool");
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function waitForDatabase(maxRetries = 5, delayMs = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query("SELECT 1");
      logger.info(`Database connection established on attempt ${attempt}`);
      return true;
    } catch (err) {
      logger.warn({ err, attempt, maxRetries }, `Database connection attempt ${attempt}/${maxRetries} failed`);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return false;
}

(async () => {
  const port = parseInt(process.env.PORT || "5000", 10);

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  try {
    const dbConnected = await waitForDatabase(5, 3000);
    if (!dbConnected) {
      logger.error("Could not connect to database after retries — continuing without DB");
    } else {
      await runMigrations();
      await seedDatabase();
      await ensureSystemChecklistModules();
      await seedHelpEntries();
      logger.info("Database initialization complete");
    }
  } catch (err) {
    logger.error({ err }, "Database initialization failed — server will continue running");
  }

  await registerRoutes(httpServer, app);

  app.use(globalErrorHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  appReady = true;
  logger.info("Application fully initialized and ready");

  const { scheduler } = await import("./lib/background-scheduler");
  const { pollEmailsJob, processImportedInvoicesJob } = await import("./lib/ap-inbox-jobs");
  const { pollTenderEmailsJob } = await import("./lib/tender-inbox-jobs");
  const { pollDraftingEmailsJob } = await import("./lib/drafting-inbox-jobs");
  const { checkLicenceExpiriesJob } = await import("./lib/licence-expiry-jobs");
  const { checkOpportunitySubmissionRemindersJob } = await import("./lib/opportunity-reminder-jobs");
  const { emailDispatchService } = await import("./services/email-dispatch.service");

  emailDispatchService.initialize();

  const EMAIL_POLL_INTERVAL = 5 * 60 * 1000;
  const EXTRACT_INTERVAL = 2 * 60 * 1000;
  const TENDER_POLL_INTERVAL = 5 * 60 * 1000;
  const DRAFTING_POLL_INTERVAL = 5 * 60 * 1000;
  const LICENCE_EXPIRY_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
  const OPPORTUNITY_REMINDER_INTERVAL = 6 * 60 * 60 * 1000;
  const EMAIL_RETRY_INTERVAL = 2 * 60 * 1000;

  scheduler.register("ap-email-poll", pollEmailsJob, EMAIL_POLL_INTERVAL);
  scheduler.register("ap-invoice-extract", processImportedInvoicesJob, EXTRACT_INTERVAL);
  scheduler.register("tender-email-poll", pollTenderEmailsJob, TENDER_POLL_INTERVAL);
  scheduler.register("drafting-email-poll", pollDraftingEmailsJob, DRAFTING_POLL_INTERVAL);
  scheduler.register("licence-expiry-check", checkLicenceExpiriesJob, LICENCE_EXPIRY_CHECK_INTERVAL);
  scheduler.register("opportunity-submission-reminder", checkOpportunitySubmissionRemindersJob, OPPORTUNITY_REMINDER_INTERVAL);
  scheduler.register("email-retry-sweep", async () => { await emailDispatchService.retryFailedEmails(); }, EMAIL_RETRY_INTERVAL);
  scheduler.start();
  logger.info("[Background] AP email poll (5min), invoice extraction (2min), tender email poll (5min), drafting email poll (5min), licence expiry check (6hr), opportunity submission reminder (6hr), and email retry sweep (2min) jobs started");

  try {
    const { eq, count } = await import("drizzle-orm");
    const { apInvoices } = await import("@shared/schema");
    const [result] = await db.select({ count: count() }).from(apInvoices).where(eq(apInvoices.status, "IMPORTED"));
    if (result && result.count > 0) {
      logger.info({ pendingInvoices: result.count }, "[Startup Recovery] Found IMPORTED invoices pending extraction — will be processed by background scheduler");
    }
  } catch (err) {
    logger.debug("[Startup Recovery] Could not check for pending invoices");
  }
})();
