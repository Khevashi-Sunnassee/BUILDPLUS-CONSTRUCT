import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { requirePermission } from "./middleware/permissions.middleware";

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
    selectedFactoryIds: user.selectedFactoryIds || []
  });
});

// Update user settings
router.put("/api/user/settings", requireAuth, async (req, res) => {
  const { selectedFactoryIds } = req.body;
  if (selectedFactoryIds !== undefined && !Array.isArray(selectedFactoryIds)) {
    return res.status(400).json({ error: "selectedFactoryIds must be an array" });
  }
  await storage.updateUserSettings(req.session.userId!, {
    selectedFactoryIds: selectedFactoryIds || null
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

// Admin: Create user
router.post("/api/admin/users", requireRole("ADMIN"), async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(403).json({ error: "Company context required" });
    }
    const existing = await storage.getUserByEmail(req.body.email);
    if (existing) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    const userData = { ...req.body, companyId: req.companyId };
    const user = await storage.createUser(userData);
    res.json({ ...user, passwordHash: undefined });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create user" });
  }
});

// Admin: Update user
router.put("/api/admin/users/:id", requireRole("ADMIN"), async (req, res) => {
  const existingUser = await storage.getUser(req.params.id as string);
  if (!existingUser || existingUser.companyId !== req.companyId) {
    return res.status(404).json({ error: "User not found" });
  }
  const updateData = { ...req.body };
  delete updateData.companyId;
  const user = await storage.updateUser(req.params.id as string, updateData);
  res.json({ ...user, passwordHash: undefined });
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
  await storage.deleteUser(req.params.id as string);
  res.json({ ok: true });
});

// Admin: Get all user permissions
router.get("/api/admin/user-permissions", requireRole("ADMIN"), async (req, res) => {
  const data = await storage.getAllUserPermissionsForAdmin();
  res.json(data);
});

// Admin: Get user permissions by userId
router.get("/api/admin/user-permissions/:userId", requireRole("ADMIN"), async (req, res) => {
  const permissions = await storage.getUserPermissions(String(req.params.userId));
  res.json(permissions);
});

// Admin: Initialize user permissions
router.post("/api/admin/user-permissions/:userId/initialize", requireRole("ADMIN"), async (req, res) => {
  const permissions = await storage.initializeUserPermissions(String(req.params.userId));
  res.json(permissions);
});

// Admin: Update user permission
router.put("/api/admin/user-permissions/:userId/:functionKey", requireRole("ADMIN"), async (req, res) => {
  const { permissionLevel } = req.body;
  if (!permissionLevel || !["HIDDEN", "VIEW", "VIEW_AND_UPDATE"].includes(permissionLevel)) {
    return res.status(400).json({ error: "Invalid permission level" });
  }
  const permission = await storage.setUserPermission(
    String(req.params.userId),
    req.params.functionKey as any,
    permissionLevel
  );
  res.json(permission);
});

export const usersRouter = router;
