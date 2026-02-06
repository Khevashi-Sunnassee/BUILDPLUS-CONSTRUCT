import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import logger from "../lib/logger";

const router = Router();

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keyContact: z.string().max(255).optional().nullable(),
  email: z.string().email("Invalid email").max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  abn: z.string().max(20).optional().nullable(),
  acn: z.string().max(20).optional().nullable(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(10).optional().nullable(),
  postcode: z.string().max(10).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  paymentTerms: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get("/api/customers", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const customersData = await storage.getAllCustomers(companyId);
    res.json(customersData);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching customers");
    res.status(500).json({ error: error.message || "Failed to fetch customers" });
  }
});

router.get("/api/customers/active", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const customersData = await storage.getActiveCustomers(companyId);
    res.json(customersData);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching active customers");
    res.status(500).json({ error: error.message || "Failed to fetch customers" });
  }
});

router.get("/api/customers/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.companyId;
    const customer = await storage.getCustomer(String(req.params.id));
    if (!customer || customer.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching customer");
    res.status(500).json({ error: error.message || "Failed to fetch customer" });
  }
});

router.post("/api/customers", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const customer = await storage.createCustomer({ ...parsed.data, companyId });
    res.json(customer);
  } catch (error: any) {
    logger.error({ err: error }, "Error creating customer");
    res.status(500).json({ error: error.message || "Failed to create customer" });
  }
});

router.patch("/api/customers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getCustomer(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const customer = await storage.updateCustomer(String(req.params.id), parsed.data);
    res.json(customer);
  } catch (error: any) {
    logger.error({ err: error }, "Error updating customer");
    res.status(500).json({ error: error.message || "Failed to update customer" });
  }
});

router.delete("/api/customers/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId;
    const existing = await storage.getCustomer(String(req.params.id));
    if (!existing || existing.companyId !== companyId) return res.status(404).json({ error: "Customer not found" });
    await storage.deleteCustomer(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, "Error deleting customer");
    res.status(500).json({ error: error.message || "Failed to delete customer" });
  }
});

export { router as customerRouter };
