import { Router } from "express";
import crudRouter from "./cost-codes/crud";
import childrenRouter from "./cost-codes/children";
import importExportRouter from "./cost-codes/import-export";
import defaultsAndJobsRouter from "./cost-codes/defaults-and-jobs";

const router = Router();

router.use(crudRouter);
router.use(childrenRouter);
router.use(importExportRouter);
router.use(defaultsAndJobsRouter);

export const costCodesRouter = router;
