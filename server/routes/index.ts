import type { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import { csrfTokenGenerator, csrfProtection } from "../middleware/csrf";
import logger from "../lib/logger";

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
import { customerRouter } from "./customer.routes";
import { procurementRouter } from "./procurement.routes";
import { procurementOrdersRouter } from "./procurement-orders.routes";
import { tasksRouter } from "./tasks.routes";
import { factoriesRouter, initializeCfmeuSync } from "./factories.routes";
import { adminRouter } from "./admin.routes";
import { agentRouter } from "./agent.routes";
import { chatRouter } from "../chat/chat.routes";
import { companiesRouter } from "./companies.routes";
import productionScheduleRouter from "./production-schedule.routes";
import { timerRouter } from "./timer.routes";
import documentsRouter from "./documents.routes";
import { reoScheduleRouter } from "./reo-schedule.routes";
import checklistRouter from "./checklist.routes";
import { broadcastRouter } from "./broadcast.routes";
import { contractsRouter } from "./contracts.routes";
import { progressClaimsRouter } from "./progress-claims.routes";
import { eotClaimsRouter } from "./eot-claims.routes";
import { assetsRouter } from "./assets.routes";
import assetRepairRouter from "./asset-repair.routes";
import { helpRouter } from "./help.routes";
import { dataManagementRouter } from "./data-management.routes";
import { employeeRouter } from "./employee.routes";
import { onboardingRouter } from "./onboarding.routes";
import { hireRouter } from "./hire.routes";
import { projectActivitiesRouter } from "./project-activities.routes";
import { pmCallLogsRouter } from "./pm-call-logs.routes";
import { invitationRouter } from "./invitation.routes";
import capexRouter from "./capex.routes";
import { costCodesRouter } from "./cost-codes.routes";
import { tenderRouter } from "./tender.routes";
import { budgetRouter } from "./budget.routes";
import { boqRouter } from "./boq.routes";
import { scopesRouter } from "./scopes.routes";
import addressLookupRouter from "./address-lookup.routes";
import { myobRouter } from "./myob.routes";
import { apInvoicesRouter } from "./ap-invoices.routes";
import { apInboxRouter } from "./ap-inbox.routes";
import { tenderInboxRouter } from "./tender-inbox.routes";
import { registerObjectStorageRoutes } from "../replit_integrations/object_storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    companyId?: string;
    name?: string;
  }
}

export async function setupRoutes(app: Express): Promise<void> {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required for session store");
  }
  
  const PgStore = connectPgSimple(session);
  
  app.use(
    session({
      store: new PgStore({
        conString: databaseUrl,
        createTableIfMissing: true,
        tableName: "session",
        pruneSessionInterval: 60 * 15,
        errorLog: (err: Error) => {
          logger.error({ err }, "Session store error");
        },
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use(cookieParser());
  app.use(csrfTokenGenerator);
  app.use("/api", csrfProtection);

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
  app.use(customerRouter);
  app.use(procurementRouter);
  app.use(procurementOrdersRouter);
  app.use(tasksRouter);
  app.use(factoriesRouter);
  app.use(adminRouter);
  app.use(companiesRouter);
  
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
  
  // Reo Schedule router - for procurement manager
  app.use(reoScheduleRouter);
  
  // Checklist router - for advanced templates system
  app.use(checklistRouter);
  
  // Broadcast router - for broadcast messaging system
  app.use(broadcastRouter);
  
  // Contracts router - for contract hub
  app.use(contractsRouter);
  
  // Progress Claims router - for progress claim management
  app.use(progressClaimsRouter);
  app.use(eotClaimsRouter);
  
  app.use(assetsRouter);
  app.use(assetRepairRouter);
  app.use(helpRouter);
  app.use(dataManagementRouter);
  app.use(employeeRouter);
  app.use(onboardingRouter);
  app.use(hireRouter);
  app.use(projectActivitiesRouter);
  app.use(pmCallLogsRouter);
  app.use(invitationRouter);
  app.use(capexRouter);
  app.use(costCodesRouter);
  app.use(tenderRouter);
  app.use(budgetRouter);
  app.use(boqRouter);
  app.use(scopesRouter);
  app.use(addressLookupRouter);
  app.use(myobRouter);
  app.use(apInvoicesRouter);
  app.use(apInboxRouter);
  app.use(tenderInboxRouter);
  
  // Agent router has relative path (/ingest)
  app.use("/api/agent", agentRouter);
  
  // Chat router already exists
  app.use("/api/chat", chatRouter);

  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);

  // Initialize CFMEU calendar sync
  initializeCfmeuSync();
}
