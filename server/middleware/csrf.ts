import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../lib/logger";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const EXEMPT_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/logout",
  "/ap-inbox/webhook",
]);

const EXEMPT_PATH_PREFIXES = [
  "/invitations/",
  "/webhooks/",
  "/v1/external/",
];

function isExemptPath(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  if (path.startsWith("/agent/")) return true;
  if (EXEMPT_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) return true;
  if (path === "/health") return true;
  return false;
}

function setCsrfCookie(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    setCsrfCookie(res);
  }
  next();
}

export function rotateCsrfToken(res: Response): void {
  setCsrfCookie(res);
}

function getRequestOrigin(req: Request): string | null {
  const origin = req.headers["origin"] as string | undefined;
  if (origin) return origin;
  const referer = req.headers["referer"] as string | undefined;
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {
      return null;
    }
  }
  return null;
}

function isValidOrigin(origin: string, req: Request): boolean {
  const host = req.headers["host"];
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;
    if (originHost === host) return true;
    if (originHost === "localhost:5000" || originHost === "0.0.0.0:5000") return true;
    if (host.endsWith(".replit.dev") && originHost.endsWith(".replit.dev")) return true;
    if (host.endsWith(".replit.app") && originHost.endsWith(".replit.app")) return true;
    return false;
  } catch {
    return false;
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (isExemptPath(req.path)) {
    return next();
  }

  if (!req.session?.userId) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin && !isValidOrigin(requestOrigin, req)) {
    logger.warn({ origin: requestOrigin, host: req.headers["host"], path: req.path }, "CSRF: Origin mismatch rejected");
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: "CSRF token missing" });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({ error: "CSRF token invalid" });
    }
  } catch {
    return res.status(403).json({ error: "CSRF token invalid" });
  }

  next();
}
