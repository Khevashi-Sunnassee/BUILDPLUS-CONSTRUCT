import type { Express } from "express";
import session from "express-session";

import { authRouter } from "./auth.routes";
import { usersRouter } from "./users.routes";
import { settingsRouter } from "./settings.routes";
import { jobsRouter } from "./jobs.routes";
import { panelsRouter } from "./panels.routes";
import { panelImportRouter } from "./panel-import.routes";
import { panelApprovalRouter } from "./panel-approval.routes";
import { panelTypesRouter } from "./panel-types.routes";
import { productionRouter } from "./production.routes";
import { productionEntriesRouter } from "./production-entries.routes";
import { productionSlotsRouter } from "./production-slots.routes";
import { draftingRouter } from "./drafting.routes";
import { logisticsRouter } from "./logistics.routes";
import { reportsRouter } from "./reports.routes";
import { dailyLogsRouter } from "./daily-logs.routes";
import { weeklyReportsRouter } from "./weekly-reports.routes";
import { productionAnalyticsRouter } from "./production-analytics.routes";
import { draftingLogisticsRouter } from "./drafting-logistics.routes";
import { costAnalyticsRouter } from "./cost-analytics.routes";
import { procurementRouter } from "./procurement.routes";
import { procurementOrdersRouter } from "./procurement-orders.routes";
import { tasksRouter } from "./tasks.routes";
import { factoriesRouter, initializeCfmeuSync } from "./factories.routes";
import { adminRouter } from "./admin.routes";
import { agentRouter } from "./agent.routes";
import { chatRouter } from "../chat/chat.routes";
import productionScheduleRouter from "./production-schedule.routes";
import { timerRouter } from "./timer.routes";
import documentsRouter from "./documents.routes";
import { registerObjectStorageRoutes } from "../replit_integrations/object_storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function setupRoutes(app: Express): Promise<void> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Mount domain routers
  // Auth router has relative paths (/login, /logout, /me)
  app.use("/api/auth", authRouter);
  
  // These routers have full paths starting with /api/ in their route definitions
  app.use(usersRouter);
  app.use(settingsRouter);
  app.use(jobsRouter);
  app.use(panelsRouter);
  app.use(panelImportRouter);
  app.use(panelApprovalRouter);
  app.use(panelTypesRouter);
  app.use(productionRouter);
  app.use(productionEntriesRouter);
  app.use(productionSlotsRouter);
  app.use(productionScheduleRouter);
  app.use(draftingRouter);
  app.use(logisticsRouter);
  app.use(procurementRouter);
  app.use(procurementOrdersRouter);
  app.use(tasksRouter);
  app.use(factoriesRouter);
  app.use(adminRouter);
  
  // Reports routers (split by domain) - all have full paths starting with /api/
  app.use(reportsRouter);
  app.use(dailyLogsRouter);
  app.use(weeklyReportsRouter);
  app.use(productionAnalyticsRouter);
  app.use(draftingLogisticsRouter);
  app.use(costAnalyticsRouter);
  
  // Timer router - for drafting time tracking
  app.use(timerRouter);
  
  // Documents router - for document management system
  app.use(documentsRouter);
  
  // Agent router has relative path (/ingest)
  app.use("/api/agent", agentRouter);
  
  // Chat router already exists
  app.use("/api/chat", chatRouter);

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Initialize CFMEU calendar sync
  initializeCfmeuSync();
}
