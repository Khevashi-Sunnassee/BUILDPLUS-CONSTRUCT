import { Router } from "express";
import entitiesRouter from "./data-management/entities";
import contactsLogisticsRouter from "./data-management/contacts-logistics";
import activitiesRouter from "./data-management/activities";
import bulkDeleteRouter from "./data-management/bulk-delete";
import financialRouter from "./data-management/financial";

export const dataManagementRouter = Router();

dataManagementRouter.use(entitiesRouter);
dataManagementRouter.use(contactsLogisticsRouter);
dataManagementRouter.use(activitiesRouter);
dataManagementRouter.use(bulkDeleteRouter);
dataManagementRouter.use(financialRouter);
