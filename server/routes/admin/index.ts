import { Router } from "express";
import devicesRouter from "./devices";
import workTypesRouter from "./work-types";
import dataManagementRouter from "./data-management";

const router = Router();

router.use(devicesRouter);
router.use(workTypesRouter);
router.use(dataManagementRouter);

export { router as adminRouter };
