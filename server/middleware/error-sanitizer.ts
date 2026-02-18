import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";
import { errorMonitor } from "../lib/error-monitor";

const isProduction = process.env.NODE_ENV === "production";

const INTERNAL_ERROR_PATTERNS = [
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /duplicate key value violates unique constraint/i,
  /violates foreign key constraint/i,
  /violates check constraint/i,
  /null value in column/i,
  /invalid input syntax/i,
  /syntax error at or near/i,
  /deadlock detected/i,
  /could not serialize access/i,
  /operator does not exist/i,
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /EHOSTUNREACH/,
  /socket hang up/i,
  /connection terminated/i,
  /too many clients/i,
  /remaining connection slots/i,
  /out of memory/i,
  /stack overflow/i,
  /Cannot read propert/i,
  /is not a function/i,
  /is not defined/i,
  /unexpected token/i,
  /JSON\.parse/i,
  /ENOMEM/,
  /EPERM/,
  /EACCES/,
  /ENOENT/,
  /\.ts:/,
  /\.js:/,
  /at Object\./,
  /at Module\./,
  /at async/,
  /node_modules\//,
];

function isInternalError(message: string): boolean {
  return INTERNAL_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

const GENERIC_MESSAGES: Record<number, string> = {
  400: "Invalid request",
  401: "Authentication required",
  403: "Access denied",
  404: "Resource not found",
  408: "Request timed out",
  409: "Conflict with existing data",
  413: "Request too large",
  422: "Invalid data provided",
  429: "Too many requests, please try again later",
  500: "An internal error occurred",
  502: "Service temporarily unavailable",
  503: "Service temporarily unavailable",
  504: "Request timed out",
};

function getGenericMessage(statusCode: number): string {
  return GENERIC_MESSAGES[statusCode] || "An error occurred";
}

function sanitizeBody(body: any, statusCode: number, req: Request): any {
  const errorField = body.error || body.message;
  if (typeof errorField !== "string" || errorField.length === 0) {
    return body;
  }

  const shouldSanitize = statusCode >= 500 || isInternalError(errorField);
  if (!shouldSanitize) {
    return body;
  }

  logger.warn(
    {
      path: req.path,
      method: req.method,
      statusCode,
      originalError: errorField.slice(0, 200),
    },
    "Sanitized error response"
  );

  errorMonitor.track(new Error(errorField), {
    route: req.path,
    method: req.method,
    statusCode,
  });

  const sanitized = { ...body };
  if (sanitized.error) {
    sanitized.error = getGenericMessage(statusCode);
  }
  if (sanitized.message && sanitized.message === errorField) {
    sanitized.message = getGenericMessage(statusCode);
  }
  delete sanitized.stack;
  delete sanitized.details;

  return sanitized;
}

export function errorSanitizer(req: Request, res: Response, next: NextFunction) {
  if (!isProduction) {
    return next();
  }

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (body: any) {
    if (res.statusCode >= 400 && body && typeof body === "object") {
      body = sanitizeBody(body, res.statusCode, req);
    }
    return originalJson(body);
  } as any;

  res.send = function (body: any) {
    if (res.statusCode >= 500 && typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === "object" && (parsed.error || parsed.message)) {
          const sanitized = sanitizeBody(parsed, res.statusCode, req);
          return originalSend(JSON.stringify(sanitized));
        }
      } catch {
        // not JSON, pass through
      }
    }
    return originalSend(body);
  } as any;

  next();
}

export function globalErrorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.status || err.statusCode || 500;

  errorMonitor.track(err instanceof Error ? err : new Error(String(err)), {
    route: req.path,
    method: req.method,
    statusCode: status,
  });

  logger.error(
    { err, route: req.path, method: req.method, statusCode: status },
    "Unhandled error"
  );

  if (res.headersSent) {
    return next(err);
  }

  const message = isProduction
    ? getGenericMessage(status)
    : err.message || "Internal Server Error";

  return res.status(status).json({ error: message });
}
