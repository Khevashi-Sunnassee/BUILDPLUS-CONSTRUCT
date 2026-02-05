import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";

const router = Router();

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  code: z.string().min(1, "Company code is required").max(10),
  isActive: z.boolean().optional().default(true),
});

router.get("/api/admin/companies", requireRole("ADMIN"), async (req, res) => {
  try {
    const allCompanies = await storage.getAllCompanies();
    res.json(allCompanies);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch companies" });
  }
});

router.get("/api/admin/companies/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch company" });
  }
});

router.post("/api/admin/companies", requireRole("ADMIN"), async (req, res) => {
  try {
    const data = companySchema.parse(req.body);
    const existing = await storage.getCompanyByCode(data.code.toUpperCase());
    if (existing) {
      return res.status(400).json({ error: "Company code already exists" });
    }
    const company = await storage.createCompany({
      name: data.name,
      code: data.code.toUpperCase(),
      isActive: data.isActive,
    });
    res.status(201).json(company);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to create company" });
  }
});

router.put("/api/admin/companies/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    const data = companySchema.partial().parse(req.body);
    const updateData: any = { ...data };
    if (data.code) {
      updateData.code = data.code.toUpperCase();
    }
    const company = await storage.updateCompany(companyId, updateData);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", issues: error.issues });
    }
    res.status(500).json({ error: error.message || "Failed to update company" });
  }
});

router.delete("/api/admin/companies/:id", requireRole("ADMIN"), async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id as string;
    if (companyId === "1") {
      return res.status(400).json({ error: "Cannot delete the default company" });
    }
    const companyUsers = await storage.getAllUsers(companyId);
    if (companyUsers.length > 0) {
      return res.status(400).json({ error: "Cannot delete company with existing users" });
    }
    await storage.deleteCompany(companyId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete company" });
  }
});

export const companiesRouter = router;
