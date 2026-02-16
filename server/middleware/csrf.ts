import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

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
];

function isExemptPath(path: string): boolean {
  if (EXEMPT_PATHS.has(path)) return true;
  if (path.startsWith("/agent/")) return true;
  if (EXEMPT_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) return true;
  if (path === "/health") return true;
  return false;
}

export function csrfTokenGenerator(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  next();
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

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: "CSRF token missing" });
  }

  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }

  next();
}
