import { Router } from "express";
import entityTypesRouter from "./checklist/entity-types.routes";
import templatesRouter from "./checklist/templates.routes";
import instancesRouter from "./checklist/instances.routes";
import workOrdersRouter from "./checklist/work-orders.routes";

const router = Router();

router.use(entityTypesRouter);
router.use(templatesRouter);
router.use(instancesRouter);
router.use(workOrdersRouter);

export default router;
