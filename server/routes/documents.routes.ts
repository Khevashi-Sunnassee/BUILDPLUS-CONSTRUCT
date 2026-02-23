import { Router } from "express";
import configRouter from "./documents/config";
import crudRouter from "./documents/crud";
import bundlesRouter from "./documents/bundles";
import publicRouter from "./documents/public";
import aiRouter from "./documents/ai";
import emailRouter from "./documents/email";
import bulkUploadRouter from "./documents/bulk-upload";
import panelsRouter from "./documents/panels";
import drawingPackageRouter from "./documents/drawing-package";
import zipUploadRouter from "./documents/zip-upload";

const router = Router();

router.use(configRouter);
router.use(crudRouter);
router.use(bundlesRouter);
router.use(publicRouter);
router.use(aiRouter);
router.use(emailRouter);
router.use(bulkUploadRouter);
router.use(panelsRouter);
router.use(drawingPackageRouter);
router.use(zipUploadRouter);

export default router;
