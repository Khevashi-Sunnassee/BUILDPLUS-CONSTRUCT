import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "../db";
import {
  externalApiKeys,
  externalApiLogs,
  jobs,
  costCodes,
  childCostCodes,
  documents,
  jobTypes,
  companies,
} from "@shared/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { requireExternalApiKey, requirePermission, requireExternalUser, getAllowedJobIdsForUser, generateUserToken } from "./middleware/external-api-auth.middleware";
import { requireAuth, requireSuperAdmin } from "./middleware/auth.middleware";
import { storage } from "../storage";
import logger from "../lib/logger";

export const externalApiRouter = Router();

externalApiRouter.use("/api/v1/external", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-User-Token");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

externalApiRouter.get("/api/v1/external/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "BuildPlus API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/v1/external/auth/login",
      jobs: "/api/v1/external/jobs",
      documents: "/api/v1/external/documents",
      costCodes: "/api/v1/external/cost-codes",
      company: "/api/v1/external/company",
    },
  });
});

externalApiRouter.get("/api/v1/external/ping", requireExternalApiKey, (req, res) => {
  res.json({
    status: "ok",
    message: "API key is valid",
    company: req.apiKey!.companyId,
    keyName: req.apiKey!.name,
    permissions: req.apiKey!.permissions,
    timestamp: new Date().toISOString(),
  });
});

function generateApiKey(): string {
  const prefix = "bp_";
  const key = crypto.randomBytes(32).toString("hex");
  return `${prefix}${key}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).default(["*"]),
  expiresAt: z.string().datetime().optional().nullable(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

externalApiRouter.get("/api/external-api-keys", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const user = await storage.getUser(userId);
    if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Only administrators can manage API keys" });
    }

    const keys = await db
      .select({
        id: externalApiKeys.id,
        name: externalApiKeys.name,
        keyPrefix: externalApiKeys.keyPrefix,
        permissions: externalApiKeys.permissions,
        isActive: externalApiKeys.isActive,
        lastUsedAt: externalApiKeys.lastUsedAt,
        createdById: externalApiKeys.createdById,
        expiresAt: externalApiKeys.expiresAt,
        createdAt: externalApiKeys.createdAt,
        updatedAt: externalApiKeys.updatedAt,
      })
      .from(externalApiKeys)
      .where(eq(externalApiKeys.companyId, companyId))
      .orderBy(desc(externalApiKeys.createdAt));

    res.json(keys);
  } catch (error) {
    logger.error({ error }, "Failed to fetch API keys");
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

externalApiRouter.post("/api/external-api-keys", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const user = await storage.getUser(userId);
    if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Only administrators can manage API keys" });
    }

    const parsed = createApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const [apiKey] = await db
      .insert(externalApiKeys)
      .values({
        companyId,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        permissions: parsed.data.permissions,
        createdById: userId,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning();

    res.status(201).json({
      ...apiKey,
      rawKey,
      keyHash: undefined,
    });
  } catch (error) {
    logger.error({ error }, "Failed to create API key");
    res.status(500).json({ error: "Failed to create API key" });
  }
});

externalApiRouter.patch("/api/external-api-keys/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const user = await storage.getUser(userId);
    if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Only administrators can manage API keys" });
    }

    const parsed = updateApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.expiresAt !== undefined) updateData.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    const [updated] = await db
      .update(externalApiKeys)
      .set(updateData)
      .where(
        sql`${externalApiKeys.id} = ${req.params.id} AND ${externalApiKeys.companyId} = ${companyId}`
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Failed to update API key");
    res.status(500).json({ error: "Failed to update API key" });
  }
});

externalApiRouter.delete("/api/external-api-keys/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const user = await storage.getUser(userId);
    if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Only administrators can manage API keys" });
    }

    const [deleted] = await db
      .delete(externalApiKeys)
      .where(
        sql`${externalApiKeys.id} = ${req.params.id} AND ${externalApiKeys.companyId} = ${companyId}`
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete API key");
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

externalApiRouter.get("/api/external-api-keys/:id/logs", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userId = req.session.userId;
    if (!companyId || !userId) return res.status(400).json({ error: "No session context" });

    const user = await storage.getUser(userId);
    if (!user || (user.role !== "ADMIN" && !user.isSuperAdmin)) {
      return res.status(403).json({ error: "Only administrators can manage API keys" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const logs = await db
      .select()
      .from(externalApiLogs)
      .where(
        sql`${externalApiLogs.apiKeyId} = ${req.params.id} AND ${externalApiLogs.companyId} = ${companyId}`
      )
      .orderBy(desc(externalApiLogs.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (error) {
    logger.error({ error }, "Failed to fetch API logs");
    res.status(500).json({ error: "Failed to fetch API logs" });
  }
});

// Super Admin routes - manage API keys for any company
externalApiRouter.get("/api/super-admin/external-api-keys", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId query parameter required" });

    const keys = await db
      .select({
        id: externalApiKeys.id,
        name: externalApiKeys.name,
        keyPrefix: externalApiKeys.keyPrefix,
        permissions: externalApiKeys.permissions,
        isActive: externalApiKeys.isActive,
        lastUsedAt: externalApiKeys.lastUsedAt,
        createdById: externalApiKeys.createdById,
        expiresAt: externalApiKeys.expiresAt,
        createdAt: externalApiKeys.createdAt,
        updatedAt: externalApiKeys.updatedAt,
      })
      .from(externalApiKeys)
      .where(eq(externalApiKeys.companyId, companyId))
      .orderBy(desc(externalApiKeys.createdAt));

    res.json(keys);
  } catch (error) {
    logger.error({ error }, "Super Admin: Failed to fetch API keys");
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

externalApiRouter.post("/api/super-admin/external-api-keys", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId query parameter required" });

    const parsed = createApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const [apiKey] = await db
      .insert(externalApiKeys)
      .values({
        companyId,
        name: parsed.data.name,
        keyHash,
        keyPrefix,
        permissions: parsed.data.permissions,
        createdById: req.session.userId!,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      })
      .returning();

    res.status(201).json({
      ...apiKey,
      rawKey,
      keyHash: undefined,
    });
  } catch (error) {
    logger.error({ error }, "Super Admin: Failed to create API key");
    res.status(500).json({ error: "Failed to create API key" });
  }
});

externalApiRouter.patch("/api/super-admin/external-api-keys/:id", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId query parameter required" });

    const parsed = updateApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.expiresAt !== undefined) updateData.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    const [updated] = await db
      .update(externalApiKeys)
      .set(updateData)
      .where(
        sql`${externalApiKeys.id} = ${req.params.id} AND ${externalApiKeys.companyId} = ${companyId}`
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json(updated);
  } catch (error) {
    logger.error({ error }, "Super Admin: Failed to update API key");
    res.status(500).json({ error: "Failed to update API key" });
  }
});

externalApiRouter.delete("/api/super-admin/external-api-keys/:id", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId query parameter required" });

    const [deleted] = await db
      .delete(externalApiKeys)
      .where(
        sql`${externalApiKeys.id} = ${req.params.id} AND ${externalApiKeys.companyId} = ${companyId}`
      )
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Super Admin: Failed to delete API key");
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

externalApiRouter.get("/api/super-admin/external-api-keys/:id/logs", requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId query parameter required" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const logs = await db
      .select()
      .from(externalApiLogs)
      .where(
        sql`${externalApiLogs.apiKeyId} = ${req.params.id} AND ${externalApiLogs.companyId} = ${companyId}`
      )
      .orderBy(desc(externalApiLogs.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (error) {
    logger.error({ error }, "Super Admin: Failed to fetch API logs");
    res.status(500).json({ error: "Failed to fetch API logs" });
  }
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

externalApiRouter.post("/api/v1/external/auth/login", requireExternalApiKey, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const companyId = req.apiKey!.companyId;

    const user = await storage.getUserByEmail(email);

    if (!user || user.companyId !== companyId) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "User account is inactive" });
    }

    const validPassword = await storage.validatePassword(user, password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const tokenData = generateUserToken(user.id, user.companyId, user.email, user.role);

    res.json({
      token: tokenData.token,
      expiresIn: tokenData.expiresIn,
      expiresAt: tokenData.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error({ error }, "External API: Login failed");
    res.status(500).json({ error: "Authentication failed" });
  }
});

externalApiRouter.get("/api/v1/external/auth/me", requireExternalApiKey, requireExternalUser, async (req, res) => {
  try {
    const user = req.externalUser!;

    const allowedJobIds = await getAllowedJobIdsForUser(user.id, user.role);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      access: {
        level: allowedJobIds === null ? "all_jobs" : "restricted",
        allowedJobCount: allowedJobIds === null ? null : allowedJobIds.size,
        allowedJobIds: allowedJobIds === null ? null : Array.from(allowedJobIds),
      },
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch user info");
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

externalApiRouter.get("/api/v1/external/jobs", requireExternalApiKey, requirePermission("read:jobs", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;
    const status = req.query.status as string | undefined;

    let allJobs = await db.select().from(jobs).where(eq(jobs.companyId, companyId)).orderBy(desc(jobs.createdAt)).limit(500);

    if (req.externalUser) {
      const allowedJobIds = await getAllowedJobIdsForUser(req.externalUser.id, req.externalUser.role);
      if (allowedJobIds !== null) {
        allJobs = allJobs.filter(j => allowedJobIds.has(j.id));
      }
    }

    const filtered = status
      ? allJobs.filter(j => j.status === status)
      : allJobs;

    res.json({
      data: filtered,
      total: filtered.length,
      userFiltered: !!req.externalUser,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch jobs");
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

externalApiRouter.get("/api/v1/external/jobs/:id", requireExternalApiKey, requirePermission("read:jobs", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;

    const [job] = await db
      .select()
      .from(jobs)
      .where(sql`${jobs.id} = ${req.params.id} AND ${jobs.companyId} = ${companyId}`)
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (req.externalUser) {
      const allowedJobIds = await getAllowedJobIdsForUser(req.externalUser.id, req.externalUser.role);
      if (allowedJobIds !== null && !allowedJobIds.has(job.id)) {
        return res.status(403).json({ error: "You do not have access to this job" });
      }
    }

    res.json({ data: job, userFiltered: !!req.externalUser });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch job");
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

externalApiRouter.get("/api/v1/external/cost-codes", requireExternalApiKey, requirePermission("read:cost-codes", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;

    const parentCodes = await db
      .select()
      .from(costCodes)
      .where(eq(costCodes.companyId, companyId))
      .orderBy(costCodes.sortOrder);

    const childCodesArr = await db
      .select()
      .from(childCostCodes)
      .where(eq(childCostCodes.companyId, companyId))
      .orderBy(childCostCodes.sortOrder);

    res.json({
      data: {
        costCodes: parentCodes,
        childCostCodes: childCodesArr,
      },
      total: parentCodes.length,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch cost codes");
    res.status(500).json({ error: "Failed to fetch cost codes" });
  }
});

externalApiRouter.get("/api/v1/external/documents", requireExternalApiKey, requirePermission("read:documents", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;
    const jobId = req.query.jobId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    let allowedJobIds: Set<string> | null = null;
    if (req.externalUser) {
      allowedJobIds = await getAllowedJobIdsForUser(req.externalUser.id, req.externalUser.role);
    }

    if (req.externalUser && allowedJobIds !== null && jobId && !allowedJobIds.has(jobId)) {
      return res.status(403).json({ error: "You do not have access to documents for this job" });
    }

    const whereClause = jobId
      ? sql`${documents.companyId} = ${companyId} AND ${documents.jobId} = ${jobId}`
      : sql`${documents.companyId} = ${companyId}`;

    let docs = await db
      .select({
        id: documents.id,
        documentNumber: documents.documentNumber,
        title: documents.title,
        description: documents.description,
        fileName: documents.fileName,
        originalName: documents.originalName,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        status: documents.status,
        version: documents.version,
        revision: documents.revision,
        isLatestVersion: documents.isLatestVersion,
        jobId: documents.jobId,
        typeId: documents.typeId,
        disciplineId: documents.disciplineId,
        categoryId: documents.categoryId,
        tags: documents.tags,
        isConfidential: documents.isConfidential,
        uploadedBy: documents.uploadedBy,
        approvedBy: documents.approvedBy,
        approvedAt: documents.approvedAt,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(whereClause)
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    if (req.externalUser && allowedJobIds !== null) {
      docs = docs.filter(d => d.jobId && allowedJobIds!.has(d.jobId));
    }

    res.json({
      data: docs,
      total: docs.length,
      limit,
      offset,
      userFiltered: !!req.externalUser,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch documents");
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

externalApiRouter.get("/api/v1/external/job-types", requireExternalApiKey, requirePermission("read:job-types", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;

    const types = await db
      .select()
      .from(jobTypes)
      .where(eq(jobTypes.companyId, companyId))
      .orderBy(jobTypes.sortOrder);

    res.json({
      data: types,
      total: types.length,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch job types");
    res.status(500).json({ error: "Failed to fetch job types" });
  }
});

externalApiRouter.get("/api/v1/external/company", requireExternalApiKey, requirePermission("read:company", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;

    const [company] = await db
      .select({
        id: companies.id,
        name: companies.name,
        code: companies.code,
        abn: companies.abn,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ data: company });
  } catch (error) {
    logger.error({ error }, "External API: Failed to fetch company");
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

const updateMarkupSchema = z.object({
  jobId: z.string().min(1),
  markups: z.array(z.object({
    costCodeId: z.string().optional(),
    costCodeCode: z.string().optional(),
    description: z.string(),
    percentage: z.number(),
    amount: z.number().optional(),
  })),
  source: z.string().default("external"),
  metadata: z.record(z.unknown()).optional(),
});

externalApiRouter.put("/api/v1/external/jobs/:id/markups", requireExternalApiKey, requirePermission("write:markups", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;
    const jobId = req.params.id as string;

    const [job] = await db
      .select()
      .from(jobs)
      .where(sql`${jobs.id} = ${jobId} AND ${jobs.companyId} = ${companyId}`)
      .limit(1);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (req.externalUser) {
      const allowedJobIds = await getAllowedJobIdsForUser(req.externalUser.id, req.externalUser.role);
      if (allowedJobIds !== null && !allowedJobIds.has(jobId)) {
        return res.status(403).json({ error: "You do not have access to this job" });
      }
    }

    const parsed = updateMarkupSchema.omit({ jobId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    await db
      .update(jobs)
      .set({
        updatedAt: new Date(),
      })
      .where(sql`${jobs.id} = ${jobId}`);

    res.json({
      success: true,
      message: "Markups received and stored",
      jobId,
      markupCount: parsed.data.markups.length,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to update markups");
    res.status(500).json({ error: "Failed to update markups" });
  }
});

const submitEstimateSchema = z.object({
  jobNumber: z.string().optional(),
  jobId: z.string().optional(),
  estimateRef: z.string().optional(),
  totalAmount: z.number(),
  lineItems: z.array(z.object({
    costCodeCode: z.string().optional(),
    description: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
    unitRate: z.number(),
    amount: z.number(),
  })).optional(),
  markups: z.array(z.object({
    description: z.string(),
    percentage: z.number().optional(),
    amount: z.number(),
  })).optional(),
  notes: z.string().optional(),
  source: z.string().default("external"),
  metadata: z.record(z.unknown()).optional(),
});

externalApiRouter.put("/api/v1/external/estimates", requireExternalApiKey, requirePermission("write:estimates", "*"), async (req, res) => {
  try {
    const companyId = req.apiKey!.companyId;

    const parsed = submitEstimateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const { jobNumber, jobId, totalAmount } = parsed.data;

    let matchedJob = null;
    if (jobId) {
      const [j] = await db
        .select()
        .from(jobs)
        .where(sql`${jobs.id} = ${jobId} AND ${jobs.companyId} = ${companyId}`)
        .limit(1);
      matchedJob = j;
    } else if (jobNumber) {
      const [j] = await db
        .select()
        .from(jobs)
        .where(sql`${jobs.jobNumber} = ${jobNumber} AND ${jobs.companyId} = ${companyId}`)
        .limit(1);
      matchedJob = j;
    }

    if (matchedJob) {
      await db
        .update(jobs)
        .set({
          estimatedValue: String(totalAmount),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, matchedJob.id));
    }

    res.json({
      success: true,
      message: "Estimate received",
      jobId: matchedJob?.id || null,
      jobNumber: matchedJob?.jobNumber || jobNumber || null,
      totalAmount,
    });
  } catch (error) {
    logger.error({ error }, "External API: Failed to submit estimate");
    res.status(500).json({ error: "Failed to submit estimate" });
  }
});

externalApiRouter.get("/api/v1/external/health", requireExternalApiKey, async (_req, res) => {
  res.json({
    status: "ok",
    version: "1.0",
    timestamp: new Date().toISOString(),
  });
});

const API_DOC_FILES: Record<string, { filename: string; path: string }> = {
  "integration-guide": {
    filename: "EXTERNAL_API_INTEGRATION_GUIDE.md",
    path: path.resolve(process.cwd(), "EXTERNAL_API_INTEGRATION_GUIDE.md"),
  },
  "schema-reference": {
    filename: "API_SCHEMA_REFERENCE.md",
    path: path.resolve(process.cwd(), "API_SCHEMA_REFERENCE.md"),
  },
};

externalApiRouter.get("/api/external-api-docs/:docKey", requireAuth, async (req, res) => {
  try {
    const docKey = req.params.docKey as string;
    const doc = API_DOC_FILES[docKey];

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!fs.existsSync(doc.path)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${doc.filename}"`);
    const stream = fs.createReadStream(doc.path);
    stream.pipe(res);
  } catch (error) {
    logger.error({ error }, "Failed to serve API documentation file");
    res.status(500).json({ error: "Failed to download file" });
  }
});
