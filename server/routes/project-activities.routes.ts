import { Router } from "express";
import jobTypesRouter from "./project-activities/job-types";
import stagesConsultantsRouter from "./project-activities/stages-consultants";
import templatesRouter from "./project-activities/templates";
import jobActivitiesRouter from "./project-activities/job-activities";
import activityDetailsRouter from "./project-activities/activity-details";
import seedImportRouter from "./project-activities/seed-import";
import activityTasksRouter from "./project-activities/activity-tasks";

const router = Router();

router.use(jobTypesRouter);
router.use(stagesConsultantsRouter);
router.use(templatesRouter);
router.use(jobActivitiesRouter);
router.use(activityDetailsRouter);
router.use(seedImportRouter);
router.use(activityTasksRouter);

export const projectActivitiesRouter = router;
