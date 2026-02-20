import { Router } from "express";
import tradesRouter from "./scopes/trades";
import crudRouter from "./scopes/crud";
import itemsRouter from "./scopes/items";
import aiRouter from "./scopes/ai";
import importExportRouter from "./scopes/import-export";
import tenderScopesRouter from "./scopes/tender-scopes";
import emailPrintRouter from "./scopes/email-print";

const router = Router();

router.use(tradesRouter);
router.use(crudRouter);
router.use(itemsRouter);
router.use(aiRouter);
router.use(importExportRouter);
router.use(tenderScopesRouter);
router.use(emailPrintRouter);

export const scopesRouter = router;
