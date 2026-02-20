import { Router } from "express";
import suppliersRouter from "./procurement/suppliers.routes";
import itemsRouter from "./procurement/items.routes";
import purchaseOrdersRouter from "./procurement/purchase-orders.routes";

const router = Router();

router.use(suppliersRouter);
router.use(itemsRouter);
router.use(purchaseOrdersRouter);

export const procurementRouter = router;
