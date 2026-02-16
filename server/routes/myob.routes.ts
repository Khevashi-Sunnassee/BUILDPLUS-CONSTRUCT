import { Router, Request, Response } from "express";
import crypto from "crypto";
import { requireAuth } from "./middleware/auth.middleware";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  storeTokens,
  getConnectionStatus,
  disconnectMyob,
  createMyobClient,
} from "../myob";
import logger from "../lib/logger";
import { db } from "../db";
import { myobTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const pendingOAuthStates = new Map<string, { companyId: string; userId: string; redirectUri: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingOAuthStates) {
    if (val.expiresAt < now) pendingOAuthStates.delete(key);
  }
}, 60000);

function buildRedirectUri(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:5000";
  return `${protocol}://${host}/api/myob/callback`;
}

router.get("/api/myob/auth", requireAuth, (req: Request, res: Response) => {
  const companyId = req.companyId;
  const userId = req.session?.userId;
  if (!companyId || !userId) {
    return res.status(400).json({ error: "Authentication required" });
  }

  const stateNonce = crypto.randomBytes(32).toString("hex");
  const redirectUri = buildRedirectUri(req);

  pendingOAuthStates.set(stateNonce, {
    companyId,
    userId,
    redirectUri,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

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

  if (!code || !businessId || !stateNonce) {
    return sendHtml("OAuth Error", "Missing code, businessId, or state in callback.", true);
  }

  const stateData = pendingOAuthStates.get(stateNonce);
  if (!stateData) {
    return sendHtml("OAuth Error", "Invalid or expired OAuth state. Please try connecting again.", true);
  }

  pendingOAuthStates.delete(stateNonce);

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

router.get("/api/myob/company", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const myob = createMyobClient(companyId);
    const data = await myob.getCompany();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

router.get("/api/myob/customers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getCustomers(query);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

router.get("/api/myob/suppliers", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getSuppliers(query);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

router.get("/api/myob/accounts", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getAccounts(query);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

router.get("/api/myob/invoices", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getInvoices(query);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

router.get("/api/myob/items", requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.companyId;
    if (!companyId) return res.status(400).json({ error: "Company context required" });

    const query = req.query.$filter ? `$filter=${req.query.$filter}` : undefined;
    const myob = createMyobClient(companyId);
    const data = await myob.getItems(query);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "MYOB request failed", details: message });
  }
});

export { router as myobRouter };
