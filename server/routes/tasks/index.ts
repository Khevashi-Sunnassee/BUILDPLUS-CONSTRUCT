import { Router } from "express";
import groupsRouter from "./groups";
import itemsRouter from "./items";
import updatesFilesRouter from "./updates-files";
import notificationsRouter from "./notifications";

const router = Router();

router.use(groupsRouter);
router.use(itemsRouter);
router.use(updatesFilesRouter);
router.use(notificationsRouter);

export { router as tasksRouter };
