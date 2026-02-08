import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import type { FunctionKey } from "@shared/schema";

const router = Router();

// Get all users for chat member selection (accessible to all authenticated users)
router.get("/api/users", requireAuth, async (req, res) => {
  const users = await storage.getAllUsers(req.companyId);
  res.json(users.map(u => ({ ...u, passwordHash: undefined })));
});

// Get user settings
router.get("/api/user/settings", requireAuth, async (req, res) => {
  const user = await storage.getUser(req.session.userId!);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({
    selectedFactoryIds: user.selectedFactoryIds || [],
    defaultFactoryId: user.defaultFactoryId || null,
  });
});

// Update user settings
router.put("/api/user/settings", requireAuth, async (req, res) => {
  const { selectedFactoryIds, defaultFactoryId } = req.body;
  if (selectedFactoryIds !== undefined && !Array.isArray(selectedFactoryIds)) {
    return res.status(400).json({ error: "selectedFactoryIds must be an array" });
  }
  if (defaultFactoryId !== undefined && defaultFactoryId !== null && typeof defaultFactoryId !== "string") {
    return res.status(400).json({ error: "defaultFactoryId must be a string or null" });
  }
  const finalSelectedFactoryIds = selectedFactoryIds !== undefined ? (selectedFactoryIds || null) : undefined;
  if (defaultFactoryId && finalSelectedFactoryIds && finalSelectedFactoryIds.length > 0 && !finalSelectedFactoryIds.includes(defaultFactoryId)) {
    finalSelectedFactoryIds.push(defaultFactoryId);
  }
  await storage.updateUserSettings(req.session.userId!, {
    selectedFactoryIds: finalSelectedFactoryIds,
    defaultFactoryId: defaultFactoryId !== undefined ? (defaultFactoryId || null) : undefined,
  });
  res.json({ success: true });
});

// Dashboard stats
router.get("/api/dashboard/stats", requireAuth, async (req, res) => {
  const stats = await storage.getDashboardStats(req.session.userId!);
  res.json(stats);
});

// Get current user's permissions
router.get("/api/my-permissions", requireAuth, async (req, res) => {
  const permissions = await storage.getUserPermissions(req.session.userId!);
  res.json(permissions);
});

// Admin: Get all users
router.get("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
  const users = await storage.getAllUsers(req.companyId);
  res.json(users.map(u => ({ ...u, passwordHash: undefined })));
});

const createUserSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  name: z.string().optional(),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).default("USER"),
  userType: z.enum(["EMPLOYEE", "EXTERNAL"]).default("EMPLOYEE"),
  departmentId: z.string().nullable().optional(),
  poApprover: z.boolean().optional(),
  poApprovalLimit: z.string().optional(),
  defaultFactoryId: z.string().nullable().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["USER", "MANAGER", "ADMIN"]).optional(),
  userType: z.enum(["EMPLOYEE", "EXTERNAL"]).optional(),
  departmentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  poApprover: z.boolean().optional(),
  poApprovalLimit: z.string().nullable().optional(),
  defaultFactoryId: z.string().nullable().optional(),
});

// Admin: Create user
router.post("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const validated = createUserSchema.parse(req.body);
    if (validated.poApprovalLimit === "") {
      validated.poApprovalLimit = undefined;
    }
    if (validated.userType === "EXTERNAL") {
      validated.departmentId = null;
    }
    if (validated.departmentId) {
      const dept = await storage.getDepartment(validated.departmentId);
      if (!dept || dept.companyId !== req.companyId) {
        return res.status(400).json({ error: "Invalid department" });
      }
    }
    const existing = await storage.getUserByEmail(validated.email);
    if (existing) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    const userData = { ...validated, companyId: req.companyId };
    const user = await storage.createUser(userData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error.message || "Failed to create user" });
  }
});

// Admin: Update user
router.put("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const existingUser = await storage.getUser(req.params.id as string);
    if (!existingUser || existingUser.companyId !== req.companyId) {
      return res.status(404).json({ error: "User not found" });
    }
    const validated = updateUserSchema.parse(req.body);
    const updateData: Record<string, any> = { ...validated };
    delete updateData.companyId;
    if (updateData.password === "") {
      delete updateData.password;
    }
    if (updateData.phone === "") {
      updateData.phone = null;
    }
    if (updateData.address === "") {
      updateData.address = null;
    }
    if (updateData.poApprovalLimit === "") {
      updateData.poApprovalLimit = null;
    }
    if (updateData.userType === "EXTERNAL") {
      updateData.departmentId = null;
    }
    if (updateData.departmentId) {
      const dept = await storage.getDepartment(updateData.departmentId);
      if (!dept || dept.companyId !== req.companyId) {
        return res.status(400).json({ error: "Invalid department" });
      }
    }
    const user = await storage.updateUser(req.params.id as string, updateData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error.message || "Failed to update user" });
  }
});

const workHoursSchema = z.object({
  mondayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  mondayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  tuesdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  tuesdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  wednesdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  wednesdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  thursdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  thursdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  fridayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  fridayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  saturdayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  saturdayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
  sundayStartTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  sundayHours: z.string().refine((v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 24; }),
});

// Admin: Update user work hours
router.put("/api/admin/users/:id/work-hours", requireRole("ADMIN"), async (req, res) => {
  try {
    const existingUser = await storage.getUser(req.params.id as string);
    if (!existingUser || existingUser.companyId !== req.companyId) {
      return res.status(404).json({ error: "User not found" });
    }
    const validatedData = workHoursSchema.parse(req.body);
    const user = await storage.updateUser(req.params.id as string, validatedData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid work hours data", details: error.errors });
    }
    throw error;
  }
});

// Admin: Delete user
router.delete("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
  const existingUser = await storage.getUser(req.params.id as string);
  if (!existingUser || existingUser.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  await storage.deleteUser(req.params.id as string);
  res.json({ ok: true });
});

// Admin: Get all user permissions
router.get("/api/admin/user-permissions", requireRole("ADMIN"), async (req, res) => {
  const data = await storage.getAllUserPermissionsForAdmin(req.companyId);
  res.json(data);
});

// Admin: Get user permissions by userId
router.get("/api/admin/user-permissions/:userId", requireRole("ADMIN"), async (req, res) => {
  const user = await storage.getUser(String(req.params.userId));
  if (!user || user.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  const permissions = await storage.getUserPermissions(String(req.params.userId));
  res.json(permissions);
});

// Admin: Initialize user permissions
router.post("/api/admin/user-permissions/:userId/initialize", requireRole("ADMIN"), async (req, res) => {
  const user = await storage.getUser(String(req.params.userId));
  if (!user || user.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  const permissions = await storage.initializeUserPermissions(String(req.params.userId));
  res.json(permissions);
});

// Admin: Update user permission
router.put("/api/admin/user-permissions/:userId/:functionKey", requireRole("ADMIN"), async (req, res) => {
  const user = await storage.getUser(String(req.params.userId));
  if (!user || user.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  const { permissionLevel } = req.body;
  if (!permissionLevel || !["HIDDEN", "VIEW", "VIEW_AND_UPDATE"].includes(permissionLevel)) {
    return res.status(400).json({ error: "Invalid permission level" });
  }
  const permission = await storage.setUserPermission(
    String(req.params.userId),
    req.params.functionKey as FunctionKey,
    permissionLevel
  );
  res.json(permission);
});

// ============================================================================
// DEPARTMENTS
// ============================================================================

const createDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.get("/api/admin/departments", requireRole("ADMIN"), async (req, res) => {
  try {
    const departments = await storage.getDepartmentsByCompany(req.companyId!);
    res.json(departments);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch departments" });
  }
});

router.post("/api/admin/departments", requireRole("ADMIN"), async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const validated = createDepartmentSchema.parse(req.body);
    const department = await storage.createDepartment({ ...validated, companyId: req.companyId });
    res.json(department);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error.message || "Failed to create department" });
  }
});

router.put("/api/admin/departments/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await storage.getDepartment(id);
    if (!existing || existing.companyId !== req.companyId) {
      return res.status(404).json({ error: "Department not found" });
    }
    const validated = updateDepartmentSchema.parse(req.body);
    const department = await storage.updateDepartment(id, validated);
    res.json(department);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error.message || "Failed to update department" });
  }
});

router.delete("/api/admin/departments/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await storage.getDepartment(id);
    if (!existing || existing.companyId !== req.companyId) {
      return res.status(404).json({ error: "Department not found" });
    }
    await storage.deleteDepartment(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete department" });
  }
});

export const usersRouter = router;
