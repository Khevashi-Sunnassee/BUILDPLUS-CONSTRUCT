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
    if (contentType) {
      const ct = contentType.toLowerCase();
      const isAllowed = ct.includes("application/json") ||
        ct.includes("multipart/form-data") ||
        ct.includes("application/x-www-form-urlencoded");
      if (!isAllowed) {
        logger.warn({ method, path: req.path, contentType }, "Unexpected content type");
        return res.status(415).json({ error: "Unsupported content type" });
      }
    }
  }
  next();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_PARAM_REGEX = /^[a-zA-Z0-9_\-:.@]+$/;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
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

export function validateAllParams(req: Request, res: Response, next: NextFunction) {
  for (const [paramName, paramValue] of Object.entries(req.params)) {
    if (typeof paramValue !== "string") continue;

    if (paramValue.length > 256) {
      return res.status(400).json({ error: `Parameter '${paramName}' exceeds maximum length` });
    }

    if (!SAFE_PARAM_REGEX.test(paramValue)) {
      return res.status(400).json({ error: `Parameter '${paramName}' contains invalid characters` });
    }
  }
  next();
}

export function validateUUIDParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const value = req.params[paramName] as string | undefined;
      if (value && !isValidUUID(value)) {
        return res.status(400).json({ error: `Invalid ${paramName}: must be a valid UUID` });
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
      if (typeof value === "string") {
        if (value.length > 2000) {
          return res.status(400).json({ error: `Query parameter '${key}' exceeds maximum length` });
        }
      }
    }
    next();
  };
}

const MAX_STRING_FIELD_LENGTH = 10000;
const MAX_TEXT_FIELD_LENGTH = 100000;
const LONG_TEXT_FIELDS = new Set([
  "content", "description", "notes", "body", "htmlBody", "textBody",
  "rawEmail", "rawBody", "emailBody", "specifications", "scope",
  "summary", "analysisResult", "aiAnalysis", "extractedData",
  "template", "htmlContent", "markdown",
]);

function enforceStringLengths(obj: unknown, path: string = ""): string | null {
  if (typeof obj === "string") {
    const fieldName = path.split(".").pop() || "";
    const maxLen = LONG_TEXT_FIELDS.has(fieldName) ? MAX_TEXT_FIELD_LENGTH : MAX_STRING_FIELD_LENGTH;
    if (obj.length > maxLen) {
      return `Field '${path}' exceeds maximum length of ${maxLen} characters`;
    }
  }
  if (Array.isArray(obj)) {
    if (obj.length > 1000) {
      return `Array '${path}' exceeds maximum of 1000 elements`;
    }
    for (let i = 0; i < obj.length; i++) {
      const err = enforceStringLengths(obj[i], `${path}[${i}]`);
      if (err) return err;
    }
  }
  if (obj && typeof obj === "object" && !(obj instanceof Date) && !Buffer.isBuffer(obj)) {
    const keys = Object.keys(obj);
    if (keys.length > 200) {
      return `Object '${path || "body"}' has too many fields (${keys.length})`;
    }
    for (const [k, v] of Object.entries(obj)) {
      const err = enforceStringLengths(v, path ? `${path}.${k}` : k);
      if (err) return err;
    }
  }
  return null;
}

const EXEMPT_BODY_LIMIT_PATHS = [
  "/api/checklist/templates",
  "/api/checklist/instances",
  "/api/knowledge-base",
  "/api/email-templates",
  "/api/broadcast",
  "/api/documents",
  "/api/scopes",
  "/api/budgets",
];

export function enforceBodyLimits(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const contentType = req.headers["content-type"];
    if (contentType && req.is("multipart/form-data")) {
      return next();
    }
    if (EXEMPT_BODY_LIMIT_PATHS.some(p => req.path.startsWith(p))) {
      return next();
    }
    const error = enforceStringLengths(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
  }
  next();
}

export function sanitizeQueryStrings(req: Request, _res: Response, next: NextFunction) {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      req.query[key] = stripScriptTags(value);
    }
  }
  next();
}
