import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#96;",
};

const HTML_ENTITY_REGEX = /[&<>"'`/]/g;

export function escapeHtml(str: string): string {
  return str.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITY_MAP[char] || char);
}

function stripScriptTags(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return stripScriptTags(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    try {
      req.body = sanitizeValue(req.body);
    } catch (err) {
      logger.warn({ err }, "Failed to sanitize request body");
    }
  }
  next();
}

export function validateContentType(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentType = req.headers["content-type"];
    if (contentType && !req.is("json") && !req.is("multipart/form-data") && !req.is("application/x-www-form-urlencoded")) {
      logger.warn({ method, path: req.path, contentType }, "Unexpected content type");
      return res.status(415).json({ error: "Unsupported content type" });
    }
  }
  next();
}

export function validateIdParam(paramName: string = "id") {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (id && typeof id === "string") {
      if (id.length > 128) {
        return res.status(400).json({ error: `Invalid ${paramName}: too long` });
      }
      if (/[<>"'`;]/.test(id)) {
        return res.status(400).json({ error: `Invalid ${paramName}: contains invalid characters` });
      }
    }
    next();
  };
}

export function validateQueryParams(allowedParams: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const unknownParams = Object.keys(req.query).filter(k => !allowedParams.includes(k));
    if (unknownParams.length > 0) {
      logger.debug({ unknownParams, path: req.path }, "Unknown query parameters received");
    }
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string" && value.length > 2000) {
        return res.status(400).json({ error: `Query parameter '${key}' exceeds maximum length` });
      }
    }
    next();
  };
}
