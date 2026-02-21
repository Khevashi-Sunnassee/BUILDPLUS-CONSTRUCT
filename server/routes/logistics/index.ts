import { Router } from "express";
import trailerTypesRouter from "./trailer-types";
import zonesRouter from "./zones";
import loadListsRouter from "./load-lists";
import deliveriesRouter from "./deliveries";

const router = Router();

router.use(trailerTypesRouter);
router.use(zonesRouter);
router.use(loadListsRouter);
router.use(deliveriesRouter);

export { router as logisticsRouter };
