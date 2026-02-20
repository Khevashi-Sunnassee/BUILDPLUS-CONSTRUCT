import { Router } from "express";
import listCountsRouter from "./drafting-inbox/list-counts";
import crudRouter from "./drafting-inbox/crud";
import processingRouter from "./drafting-inbox/processing";
import settingsRouter from "./drafting-inbox/settings";

const router = Router();

router.use(listCountsRouter);
router.use(crudRouter);
router.use(processingRouter);
router.use(settingsRouter);

export { router as draftingInboxRouter };
export default router;
