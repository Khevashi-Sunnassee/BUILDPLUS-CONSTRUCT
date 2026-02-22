import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../../db";
import { externalApiKeys, externalApiLogs, jobMembers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "../../storage";
import logger from "../../lib/logger";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for external API authentication");
}
const TOKEN_EXPIRY = "1h";

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        companyId: string;
        name: string;
        permissions: string[];
      };
      externalUser?: {
        id: string;
        companyId: string;
        email: string;
        name: string | null;
        role: string;
        isSuperAdmin: boolean;
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

    const userToken = req.headers["x-user-token"] as string | undefined;
    if (userToken) {
      try {
        const decoded = jwt.verify(userToken, JWT_SECRET) as {
          userId: string;
          companyId: string;
          email: string;
          role: string;
        };

        if (decoded.companyId !== apiKey.companyId) {
          return res.status(403).json({
            error: "User token company does not match API key company",
          });
        }

        const user = await storage.getUser(decoded.userId);
        if (!user || !user.isActive) {
          return res.status(401).json({ error: "User account is inactive or not found" });
        }

        if (user.companyId !== apiKey.companyId) {
          return res.status(403).json({ error: "User does not belong to this company" });
        }

        req.externalUser = {
          id: user.id,
          companyId: user.companyId,
          email: user.email,
          name: user.name,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
        };
      } catch (jwtErr: any) {
        if (jwtErr.name === "TokenExpiredError") {
          return res.status(401).json({ error: "User token has expired. Please login again." });
        }
        if (jwtErr.name === "JsonWebTokenError") {
          return res.status(401).json({ error: "Invalid user token" });
        }
        return res.status(401).json({ error: "User token validation failed" });
      }
    }

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

export function requireExternalUser(req: Request, res: Response, next: NextFunction) {
  if (!req.externalUser) {
    return res.status(401).json({
      error: "User authentication required",
      message: "This endpoint requires a user token. Login via POST /api/v1/external/auth/login first, then include the token in the X-User-Token header.",
    });
  }
  next();
}

export async function getAllowedJobIdsForUser(userId: string, role: string): Promise<Set<string> | null> {
  if (role === "ADMIN" || role === "MANAGER") {
    return null;
  }

  const memberships = await db.select({ jobId: jobMembers.jobId })
    .from(jobMembers)
    .where(eq(jobMembers.userId, userId));
  return new Set(memberships.map(m => m.jobId));
}

export function generateUserToken(userId: string, companyId: string, email: string, role: string): { token: string; expiresIn: string; expiresAt: string } {
  const token = jwt.sign(
    { userId, companyId, email, role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return { token, expiresIn: TOKEN_EXPIRY, expiresAt };
}
