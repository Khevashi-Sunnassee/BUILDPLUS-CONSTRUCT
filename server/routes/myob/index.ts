import { Router } from "express";
import { authRouter } from "./auth";
import { dataRouter } from "./data";
import { mappingsRouter } from "./mappings";
import { financialRouter } from "./financial";
import { importRouter } from "./import";
import { bulkImportRouter } from "./bulk-import";

const router = Router();

router.use(authRouter);
router.use(dataRouter);
router.use(mappingsRouter);
router.use(financialRouter);
router.use(importRouter);
router.use(bulkImportRouter);

export { router as myobRouter };
