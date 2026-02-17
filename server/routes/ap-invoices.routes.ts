import { Router } from "express";
import { db } from "../db";
import { objectStorageService, upload, logActivity } from "./ap-invoices/shared";
import type { SharedDeps } from "./ap-invoices/shared";
import { registerCoreRoutes } from "./ap-invoices/core.routes";
import { registerWorkflowRoutes } from "./ap-invoices/workflow.routes";
import { registerSplitsRoutes } from "./ap-invoices/splits.routes";
import { registerApprovalRulesRoutes } from "./ap-invoices/approval-rules.routes";
import { registerDocumentsRoutes } from "./ap-invoices/documents.routes";

const router = Router();

const deps: SharedDeps = { db, objectStorageService, upload, logActivity };

registerCoreRoutes(router, deps);
registerWorkflowRoutes(router, deps);
registerSplitsRoutes(router, deps);
registerApprovalRulesRoutes(router, deps);
registerDocumentsRoutes(router, deps);

export { router as apInvoicesRouter };
