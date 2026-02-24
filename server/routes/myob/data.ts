import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { createMyobClient } from "../../myob";
import { handleMyobError } from "./helpers";

const router = Router();

router.get("/api/myob/company", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    const data = await myob.getCompany();
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "company");
  }
});

router.get("/api/myob/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getCustomers(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "customers");
  }
});

router.get("/api/myob/suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getSuppliers(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "suppliers");
  }
});

router.get("/api/myob/accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getAccounts(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "accounts");
  }
});

router.get("/api/myob/invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getInvoices(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "invoices");
  }
});

router.get("/api/myob/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getItems(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "items");
  }
});

router.get("/api/myob/jobs", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getJobs(query);
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "jobs");
  }
});

router.get("/api/myob/tax-codes", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const myob = createMyobClient(companyId);
    const data = await myob.getTaxCodes();
    res.json(data);
  } catch (err) {
    handleMyobError(err, res, "tax-codes");
  }
});

export { router as dataRouter };
