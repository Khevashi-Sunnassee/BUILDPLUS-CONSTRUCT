import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  storeTokens,
  getConnectionStatus,
  disconnectMyob,
} from "../../myob";
import logger from "../../lib/logger";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { buildRedirectUri } from "./helpers";

const router = Router();

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS myob_oauth_states (
        nonce TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create myob_oauth_states table");
  }
})();

router.get("/api/myob/auth", requireAuth, async (req: Request, res: Response) => {
  const companyId = req.companyId;
  const userId = req.session?.userId;
  if (!companyId || !userId) {
    return res.status(400).json({ error: "Authentication required" });
  }

  const stateNonce = crypto.randomBytes(32).toString("hex");
  const redirectUri = buildRedirectUri(req);
  const expiresAt = Date.now() + 10 * 60 * 1000;

  try {
    await db.execute(sql`DELETE FROM myob_oauth_states WHERE expires_at < ${Date.now()}`);
    await db.execute(sql`
      INSERT INTO myob_oauth_states (nonce, company_id, user_id, redirect_uri, expires_at)
      VALUES (${stateNonce}, ${companyId}, ${userId}, ${redirectUri}, ${expiresAt})
    `);
  } catch (err) {
    logger.error({ err }, "Failed to store OAuth state in database");
    return res.status(500).json({ error: "Failed to initiate OAuth flow" });
  }

  const authUrl = getAuthorizationUrl(redirectUri);
  res.redirect(`${authUrl}&state=${encodeURIComponent(stateNonce)}`);
});

router.get("/api/myob/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const businessId = req.query.businessId as string | undefined;
  const stateNonce = req.query.state as string | undefined;

  const sendHtml = (title: string, message: string, isError = false) => {
    res.status(isError ? 400 : 200).send(
      `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
      `<h1>${title}</h1><p>${message}</p>` +
      `<script>setTimeout(function(){window.close()},${isError ? 5000 : 2000})</script>` +
      `</body></html>`
    );
  };

  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  logger.info({ 
    hasCode: !!code, 
    hasBusinessId: !!businessId, 
    hasState: !!stateNonce,
    error,
    errorDescription,
    queryKeys: Object.keys(req.query),
    fullUrl: req.originalUrl
  }, "MYOB OAuth callback received");

  if (error) {
    logger.warn({ error, errorDescription }, "MYOB OAuth returned error");
    return sendHtml("MYOB Connection Error", `${error}: ${errorDescription || 'Unknown error'}`, true);
  }

  if (!code || !businessId || !stateNonce) {
    logger.warn({ code: !!code, businessId: !!businessId, state: !!stateNonce, query: req.query }, "MYOB callback missing parameters");
    return sendHtml("OAuth Error", `Missing parameters: ${!code ? 'code ' : ''}${!businessId ? 'businessId ' : ''}${!stateNonce ? 'state' : ''}`, true);
  }

  const rows = await db.execute(sql`
    SELECT company_id, user_id, redirect_uri, expires_at
    FROM myob_oauth_states
    WHERE nonce = ${stateNonce}
  `);
  const stateRow = rows.rows?.[0] as { company_id: string; user_id: string; redirect_uri: string; expires_at: string } | undefined;
  if (!stateRow) {
    return sendHtml("OAuth Error", "Invalid or expired OAuth state. Please try connecting again.", true);
  }

  const stateData = {
    companyId: stateRow.company_id,
    userId: stateRow.user_id,
    redirectUri: stateRow.redirect_uri,
    expiresAt: Number(stateRow.expires_at),
  };

  await db.execute(sql`DELETE FROM myob_oauth_states WHERE nonce = ${stateNonce}`);

  if (stateData.expiresAt < Date.now()) {
    return sendHtml("OAuth Error", "OAuth session expired. Please try connecting again.", true);
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code, businessId, stateData.redirectUri);
    await storeTokens(stateData.companyId, stateData.userId, tokenResponse, businessId);
    logger.info({ companyId: stateData.companyId }, "MYOB OAuth connected successfully");

    const origin = new URL(stateData.redirectUri).origin;
    res.send(
      `<!DOCTYPE html><html><head><title>MYOB Connected</title></head><body>` +
      `<h1>MYOB Connected Successfully</h1>` +
      `<p>Your MYOB account has been linked. This window will close automatically.</p>` +
      `<script>` +
      `if(window.opener){window.opener.postMessage({type:'MYOB_OAUTH_SUCCESS'},${JSON.stringify(origin)})}` +
      `setTimeout(function(){window.close()},2000)` +
      `</script></body></html>`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "MYOB OAuth token exchange failed");
    sendHtml("Connection Failed", "Token exchange failed. Please try again.", true);
  }
});

router.get("/api/myob/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const status = await getConnectionStatus(companyId);
    res.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to check MYOB status", details: message });
  }
});

router.post("/api/myob/disconnect", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    await disconnectMyob(companyId);
    logger.info({ companyId }, "MYOB disconnected");
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed to disconnect MYOB", details: message });
  }
});

export { router as authRouter };
