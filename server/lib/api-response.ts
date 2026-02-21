import type { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendError(res: Response, statusCode: number, message: string): void {
  res.status(statusCode).json({ error: message });
}

export function sendBadRequest(res: Response, message = "Bad request"): void {
  sendError(res, 400, message);
}

export function sendUnauthorized(res: Response, message = "Authentication required"): void {
  sendError(res, 401, message);
}

export function sendForbidden(res: Response, message = "Access denied"): void {
  sendError(res, 403, message);
}

export function sendNotFound(res: Response, message = "Not found"): void {
  sendError(res, 404, message);
}

export function sendConflict(res: Response, message = "Conflict"): void {
  sendError(res, 409, message);
}

export function sendTooManyRequests(res: Response, message = "Too many requests, please try again later"): void {
  sendError(res, 429, message);
}

export function sendServerError(res: Response, message = "Internal server error"): void {
  sendError(res, 500, message);
}

export function sendPaginated<T>(res: Response, data: T[], pagination: { page: number; limit: number; total: number }): void {
  res.status(200).json({
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}
