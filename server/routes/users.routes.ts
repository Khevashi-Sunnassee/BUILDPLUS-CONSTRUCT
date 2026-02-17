import { Router } from "express";
import { z } from "zod";
import { eq, and, lte, notInArray } from "drizzle-orm";
import { storage, db } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";
import { tasks, taskAssignees, taskGroups, jobs, permissionTypes, FUNCTION_KEYS } from "@shared/schema";
import type { FunctionKey, PermissionLevel } from "@shared/schema";
import logger from "../lib/logger";

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

const userSettingsSchema = z.object({
  selectedFactoryIds: z.array(z.string()).optional(),
  defaultFactoryId: z.string().nullable().optional(),
});

// Update user settings
router.put("/api/user/settings", requireAuth, async (req, res) => {
  const result = userSettingsSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.errors });
  }
  const { selectedFactoryIds, defaultFactoryId } = result.data;
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

// Dashboard: Get due/overdue tasks assigned to current user
router.get("/api/dashboard/my-due-tasks", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const result = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
        groupId: tasks.groupId,
        groupName: taskGroups.name,
        jobId: tasks.jobId,
        jobName: jobs.name,
        jobNumber: jobs.jobNumber,
      })
      .from(tasks)
      .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
      .innerJoin(taskGroups, eq(taskGroups.id, tasks.groupId))
      .leftJoin(jobs, eq(jobs.id, tasks.jobId))
      .where(
        and(
          eq(taskAssignees.userId, req.session.userId!),
          lte(tasks.dueDate, now),
          notInArray(tasks.status, ["DONE"])
        )
      );

    const tasksWithOverdue = result.map(t => ({
      ...t,
      isOverdue: t.dueDate ? new Date(t.dueDate) < now : false,
    }));

    tasksWithOverdue.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    res.json({ tasks: tasksWithOverdue.slice(0, 20), totalCount: tasksWithOverdue.length });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching due tasks");
    res.status(500).json({ error: "Failed to fetch due tasks" });
  }
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
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    const validated = parseResult.data;
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create user" });
  }
});

// Admin: Update user
router.put("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const existingUser = await storage.getUser(req.params.id as string);
    if (!existingUser || existingUser.companyId !== req.companyId) {
      return res.status(404).json({ error: "User not found" });
    }
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    const validated = parseResult.data;
    const updateData: Record<string, unknown> = { ...validated };
    delete updateData.companyId;
    if (updateData.password === "" || updateData.password === undefined) {
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
      const dept = await storage.getDepartment(updateData.departmentId as string);
      if (!dept || dept.companyId !== req.companyId) {
        return res.status(400).json({ error: "Invalid department" });
      }
    }
    const user = await storage.updateUser(req.params.id as string, updateData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update user" });
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
    const parseResult = workHoursSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid work hours data", details: parseResult.error.errors });
    }
    const validatedData = parseResult.data;
    const user = await storage.updateUser(req.params.id as string, validatedData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error: unknown) {
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

const updatePermissionSchema = z.object({
  permissionLevel: z.enum(["HIDDEN", "VIEW", "VIEW_AND_UPDATE", "VIEW_OWN", "VIEW_AND_UPDATE_OWN"]),
});

// Admin: Update user permission
router.put("/api/admin/user-permissions/:userId/:functionKey", requireRole("ADMIN"), async (req, res) => {
  const userId = req.params.userId as string;
  const functionKey = req.params.functionKey as FunctionKey;
  const user = await storage.getUser(userId);
  if (!user || user.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  const result = updatePermissionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.errors });
  }
  const { permissionLevel } = result.data;
  const permission = await storage.setUserPermission(
    userId,
    functionKey,
    permissionLevel
  );
  res.json(permission);
});

// ============================================================================
// PERMISSION TYPES
// ============================================================================

const permissionTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  permissions: z.record(z.enum(["HIDDEN", "VIEW", "VIEW_AND_UPDATE", "VIEW_OWN", "VIEW_AND_UPDATE_OWN"])),
  isDefault: z.boolean().optional(),
});

router.get("/api/admin/permission-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId!;
    const types = await db.select().from(permissionTypes)
      .where(eq(permissionTypes.companyId, companyId))
      .orderBy(permissionTypes.name)
      .limit(100);
    res.json(types);
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching permission types");
    res.status(500).json({ error: "Failed to fetch permission types" });
  }
});

router.post("/api/admin/permission-types", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId!;
    const data = permissionTypeSchema.parse(req.body);

    const [existing] = await db.select({ id: permissionTypes.id })
      .from(permissionTypes)
      .where(and(eq(permissionTypes.companyId, companyId), eq(permissionTypes.name, data.name)))
      .limit(1);
    if (existing) {
      return res.status(400).json({ error: "A permission type with this name already exists" });
    }

    const [created] = await db.insert(permissionTypes).values({
      companyId,
      name: data.name,
      description: data.description || null,
      permissions: data.permissions,
      isDefault: data.isDefault || false,
    }).returning();

    res.status(201).json(created);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    logger.error({ err: error }, "Error creating permission type");
    res.status(500).json({ error: "Failed to create permission type" });
  }
});

router.patch("/api/admin/permission-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId!;
    const id = req.params.id;
    const data = permissionTypeSchema.partial().parse(req.body);

    const [existing] = await db.select().from(permissionTypes)
      .where(and(eq(permissionTypes.id, id), eq(permissionTypes.companyId, companyId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Permission type not found" });

    if (data.name && data.name !== existing.name) {
      const [dup] = await db.select({ id: permissionTypes.id })
        .from(permissionTypes)
        .where(and(eq(permissionTypes.companyId, companyId), eq(permissionTypes.name, data.name)))
        .limit(1);
      if (dup) return res.status(400).json({ error: "A permission type with this name already exists" });
    }

    const updates: any = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.permissions !== undefined) updates.permissions = data.permissions;
    if (data.isDefault !== undefined) updates.isDefault = data.isDefault;

    const [updated] = await db.update(permissionTypes)
      .set(updates)
      .where(and(eq(permissionTypes.id, id), eq(permissionTypes.companyId, companyId)))
      .returning();

    res.json(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    logger.error({ err: error }, "Error updating permission type");
    res.status(500).json({ error: "Failed to update permission type" });
  }
});

router.delete("/api/admin/permission-types/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId!;
    const id = req.params.id;

    const [existing] = await db.select().from(permissionTypes)
      .where(and(eq(permissionTypes.id, id), eq(permissionTypes.companyId, companyId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Permission type not found" });

    await db.delete(permissionTypes)
      .where(and(eq(permissionTypes.id, id), eq(permissionTypes.companyId, companyId)));

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error deleting permission type");
    res.status(500).json({ error: "Failed to delete permission type" });
  }
});

router.post("/api/admin/user-permissions/:userId/apply-type", requireRole("ADMIN"), async (req, res) => {
  try {
    const companyId = req.companyId!;
    const userId = req.params.userId;

    const body = z.object({ permissionTypeId: z.string() }).parse(req.body);

    const user = await storage.getUser(userId);
    if (!user || user.companyId !== companyId) {
      return res.status(404).json({ error: "User not found" });
    }

    const [permType] = await db.select().from(permissionTypes)
      .where(and(eq(permissionTypes.id, body.permissionTypeId), eq(permissionTypes.companyId, companyId)))
      .limit(1);
    if (!permType) return res.status(404).json({ error: "Permission type not found" });

    const permsToApply = permType.permissions as Record<string, PermissionLevel>;

    for (const functionKey of FUNCTION_KEYS) {
      const level = permsToApply[functionKey] || "VIEW_AND_UPDATE";
      await storage.setUserPermission(userId, functionKey as FunctionKey, level as PermissionLevel);
    }

    const updatedPerms = await storage.getUserPermissions(userId);
    res.json({ permissions: updatedPerms, appliedType: permType.name });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    logger.error({ err: error }, "Error applying permission type");
    res.status(500).json({ error: "Failed to apply permission type" });
  }
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

router.get("/api/departments", requireAuth, async (req, res) => {
  try {
    const departments = await storage.getDepartmentsByCompany(req.companyId!);
    res.json(departments);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch departments" });
  }
});

router.get("/api/admin/departments", requireRole("ADMIN"), async (req, res) => {
  try {
    const departments = await storage.getDepartmentsByCompany(req.companyId!);
    res.json(departments);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch departments" });
  }
});

router.post("/api/admin/departments", requireRole("ADMIN"), async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const parseResult = createDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    const validated = parseResult.data;
    const department = await storage.createDepartment({ ...validated, companyId: req.companyId });
    res.json(department);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create department" });
  }
});

router.put("/api/admin/departments/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await storage.getDepartment(id);
    if (!existing || existing.companyId !== req.companyId) {
      return res.status(404).json({ error: "Department not found" });
    }
    const parseResult = updateDepartmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }
    const validated = parseResult.data;
    const department = await storage.updateDepartment(id, validated);
    res.json(department);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update department" });
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
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete department" });
  }
});

export const usersRouter = router;
