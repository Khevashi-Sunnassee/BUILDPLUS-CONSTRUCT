import { Router } from "express";
import budgetCrudRouter from "./budget/crud";
import budgetLinesRouter from "./budget/lines";
import budgetUpdatesFilesRouter from "./budget/updates-files";

const router = Router();

router.use(budgetCrudRouter);
router.use(budgetLinesRouter);
router.use(budgetUpdatesFilesRouter);

export const budgetRouter = router;
