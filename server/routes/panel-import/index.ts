import { Router } from "express";
import bulkImportRouter from "./bulk-import";
import estimateImportRouter from "./estimate-import";

const router = Router();

router.use(bulkImportRouter);
router.use(estimateImportRouter);

export { router as panelImportRouter };
