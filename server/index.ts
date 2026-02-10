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
import { pool } from "./db";

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
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.set("trust proxy", 1);

const sessionKeyGenerator = (req: Request): string => {
  const sessionId = (req as any).session?.id;
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

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

const downloadsPath = path.join(process.cwd(), 'public/downloads');
app.use('/download-files', express.static(downloadsPath), serveIndex(downloadsPath, { icons: true }));

const chatUploadsPath = path.join(process.cwd(), 'uploads', 'chat');
app.use('/uploads/chat', express.static(chatUploadsPath));
const httpServer = createServer(app);

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

// Request-ID middleware for tracing
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as any).requestId = requestId;
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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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
    }
  });

  next();
});

app.get("/api/admin/error-summary", (req, res) => {
  if (!req.session?.userId || (req.session as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  res.json(errorMonitor.getSummary());
});

app.get("/api/health", (req, res) => {
  const isAdmin = (req as any).session?.role === "ADMIN";

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

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info(`Received ${signal} — starting graceful shutdown`);
  
  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 15s — forcing exit");
    process.exit(1);
  }, 15000);
  forceExitTimer.unref();
  
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

(async () => {
  await runMigrations();
  await seedDatabase();
  await ensureSystemChecklistModules();
  await seedHelpEntries();
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    errorMonitor.track(err instanceof Error ? err : new Error(String(err)), {
      route: req.path,
      method: req.method,
      statusCode: status,
    });

    logger.error({ err, route: req.path, method: req.method, statusCode: status }, "Internal Server Error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
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
})();
