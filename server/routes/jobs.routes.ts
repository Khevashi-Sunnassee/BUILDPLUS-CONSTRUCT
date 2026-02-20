import { Router } from "express";
import opportunitiesRouter from "./jobs/opportunities";
import crudRouter from "./jobs/crud";
import levelsProgrammeRouter from "./jobs/levels-programme";
import adminRouter from "./jobs/admin";
import opportunityUpdatesRouter from "./jobs/opportunity-updates";

const router = Router();

router.use(opportunitiesRouter);
router.use(crudRouter);
router.use(levelsProgrammeRouter);
router.use(adminRouter);
router.use(opportunityUpdatesRouter);

export const jobsRouter = router;
