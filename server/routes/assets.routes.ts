import { Router } from "express";
import importExportRouter from "./assets/import-export.routes";
import crudRouter from "./assets/crud.routes";
import maintenanceTransfersRouter from "./assets/maintenance-transfers.routes";

const router = Router();

router.use(importExportRouter);
router.use(crudRouter);
router.use(maintenanceTransfersRouter);

export const assetsRouter = router;
