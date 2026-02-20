import { Router } from "express";
import claimsRouter from "./claims.routes";
import actionsRouter from "./actions.routes";
import reportsRouter from "./reports.routes";

const router = Router();

router.use(reportsRouter);
router.use(actionsRouter);
router.use(claimsRouter);

export default router;
