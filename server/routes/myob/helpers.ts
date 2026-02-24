import { Request, Response } from "express";
import logger from "../../lib/logger";

export function handleMyobError(err: unknown, res: Response, context: string) {
  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error({ err: message }, `Error in MYOB ${context}`);
  const isAuthError = message.includes("401") || message.includes("authentication failed") || message.includes("OAuthTokenIsInvalid");
  const userMessage = isAuthError
    ? "MYOB authentication expired. Please disconnect and reconnect your MYOB account from the Overview tab."
    : `MYOB request failed: ${message}`;
  res.status(isAuthError ? 401 : 500).json({ error: userMessage });
}

export function buildRedirectUri(req: Request): string {
  if (process.env.MYOB_REDIRECT_URI) {
    return process.env.MYOB_REDIRECT_URI;
  }
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
  return `${protocol}://${host}/api/myob/callback`;
}
