import { Request, Response } from "express";
import { z, ZodSchema } from "zod";
import logger from "./logger";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function parsePagination(req: Request, defaults?: { page?: number; limit?: number; maxLimit?: number }): PaginationParams {
  const maxLimit = defaults?.maxLimit ?? 200;
  const defaultLimit = defaults?.limit ?? 50;
  const defaultPage = defaults?.page ?? 1;

  const page = Math.max(1, parseInt(req.query.page as string) || defaultPage);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || defaultLimit));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasMore: params.page < totalPages,
    },
  };
}

export interface SortParams {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function parseSort(req: Request, allowedFields: string[], defaults?: { sortBy?: string; sortOrder?: "asc" | "desc" }): SortParams {
  const sortBy = (req.query.sortBy as string) || defaults?.sortBy || "createdAt";
  const sortOrder = ((req.query.sortOrder as string) || defaults?.sortOrder || "desc").toLowerCase() as "asc" | "desc";

  const validSortBy = allowedFields.includes(sortBy) ? sortBy : (defaults?.sortBy || allowedFields[0] || "createdAt");
  const validSortOrder = ["asc", "desc"].includes(sortOrder) ? sortOrder : "desc";

  return { sortBy: validSortBy, sortOrder: validSortOrder };
}

export function parseFilters(req: Request, allowedFilters: string[]): Record<string, string | string[]> {
  const filters: Record<string, string | string[]> = {};
  for (const key of allowedFilters) {
    const value = req.query[key];
    if (value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        filters[key] = value.map(String);
      } else {
        filters[key] = String(value);
      }
    }
  }
  return filters;
}

export function parseSearch(req: Request, paramName = "search"): string | undefined {
  const search = req.query[paramName];
  if (typeof search === "string" && search.trim().length > 0) {
    return search.trim().slice(0, 500);
  }
  return undefined;
}

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function handleValidationError(res: Response, errors: z.ZodError): Response {
  const formattedErrors = errors.errors.map(e => ({
    field: e.path.join("."),
    message: e.message,
  }));
  return res.status(400).json({ error: "Validation failed", details: formattedErrors });
}

export function handleApiError(res: Response, err: unknown, context: string): Response {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: error, context }, `API error in ${context}`);
  return res.status(500).json({ error: "Internal server error" });
}

export function requireParam(req: Request, res: Response, paramName: string): string | null {
  const value = req.params[paramName];
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    res.status(400).json({ error: `Missing required parameter: ${paramName}` });
    return null;
  }
  return value.trim();
}

export function successResponse<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json(data);
}

export function createdResponse<T>(res: Response, data: T): Response {
  return res.status(201).json(data);
}

export function noContentResponse(res: Response): Response {
  return res.status(204).end();
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function requireUUID(req: Request, res: Response, paramName: string): string | null {
  const value = req.params[paramName];
  if (!value || typeof value !== "string" || !UUID_REGEX.test(value.trim())) {
    res.status(400).json({ error: `Invalid ${paramName} format` });
    return null;
  }
  return value.trim();
}

export function safeJsonParse<T = unknown>(text: string, fallback?: T): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (err) {
    if (fallback !== undefined) {
      return { success: true, data: fallback };
    }
    return { success: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}
