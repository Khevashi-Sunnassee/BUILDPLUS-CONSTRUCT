import type { Express } from "express";
import session from "express-session";

import { authRouter } from "./auth.routes";
import { usersRouter } from "./users.routes";
import { settingsRouter } from "./settings.routes";
import { jobsRouter } from "./jobs.routes";
import { panelsRouter } from "./panels.routes";
import { productionRouter } from "./production.routes";
import { draftingRouter } from "./drafting.routes";
import { logisticsRouter } from "./logistics.routes";
import { reportsRouter } from "./reports.routes";
import { procurementRouter } from "./procurement.routes";
import { tasksRouter } from "./tasks.routes";
import { factoriesRouter, initializeCfmeuSync } from "./factories.routes";
import { adminRouter } from "./admin.routes";
import { agentRouter } from "./agent.routes";
import { chatRouter } from "../chat/chat.routes";

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
  app.use(productionRouter);
  app.use(draftingRouter);
  app.use(logisticsRouter);
  app.use(procurementRouter);
  app.use(tasksRouter);
  app.use(factoriesRouter);
  app.use(adminRouter);
  
  // Reports router has full paths starting with /api/
  app.use(reportsRouter);
  
  // Agent router has relative path (/ingest)
  app.use("/api/agent", agentRouter);
  
  // Chat router already exists
  app.use("/api/chat", chatRouter);

  // Initialize CFMEU calendar sync
  initializeCfmeuSync();
}
