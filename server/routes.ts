import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupRoutes } from "./routes/index";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupRoutes(app);
  return httpServer;
}
