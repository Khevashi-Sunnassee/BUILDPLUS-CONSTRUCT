import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../../db";
import { externalApiKeys, externalApiLogs } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import logger from "../../lib/logger";

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        companyId: string;
        name: string;
        permissions: string[];
      };
    }
  }
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function requireExternalApiKey(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const authHeader = req.headers["authorization"];
  const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

  let rawKey: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawKey = authHeader.slice(7);
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader;
  }

  if (!rawKey) {
    return res.status(401).json({
      error: "API key required",
      message: "Provide an API key via Authorization: Bearer <key> or X-API-Key header",
    });
  }

  try {
    const keyHash = hashApiKey(rawKey);
    const prefix = rawKey.substring(0, 8);

    const [apiKey] = await db
      .select()
      .from(externalApiKeys)
      .where(
        and(
          eq(externalApiKeys.keyHash, keyHash),
          eq(externalApiKeys.isActive, true)
        )
      )
      .limit(1);

    if (!apiKey) {
      return res.status(401).json({ error: "Invalid or inactive API key" });
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return res.status(401).json({ error: "API key has expired" });
    }

    await db
      .update(externalApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalApiKeys.id, apiKey.id));

    req.apiKey = {
      id: apiKey.id,
      companyId: apiKey.companyId,
      name: apiKey.name,
      permissions: (apiKey.permissions as string[]) || [],
    };

    res.on("finish", () => {
      const responseTime = Date.now() - startTime;
      db.insert(externalApiLogs)
        .values({
          companyId: apiKey.companyId,
          apiKeyId: apiKey.id,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null,
          userAgent: req.headers["user-agent"] || null,
        })
        .catch((err) => {
          logger.error({ err }, "Failed to log external API request");
        });
    });

    next();
  } catch (error) {
    logger.error({ error }, "External API authentication error");
    return res.status(500).json({ error: "Authentication service error" });
  }
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const apiPermissions = req.apiKey.permissions;

    if (apiPermissions.includes("*")) {
      return next();
    }

    const hasPermission = permissions.some((p) => apiPermissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({
        error: "Insufficient permissions",
        required: permissions,
        granted: apiPermissions,
      });
    }

    next();
  };
}
