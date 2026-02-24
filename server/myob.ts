import { db } from "./db";
import { myobTokens } from "@shared/schema";
import { eq } from "drizzle-orm";
import logger from "./lib/logger";

const MYOB_AUTH_URL = "https://secure.myob.com/oauth2/account/authorize";
const MYOB_TOKEN_URL = "https://secure.myob.com/oauth2/v1/authorize";
const MYOB_API_BASE = "https://api.myob.com/accountright";

export interface MyobTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
  refresh_token: string;
  scope?: string;
  user?: { uid: string; username: string };
}

export function getAuthorizationUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MYOB_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "CompanyFile",
    prompt: "consent",
  });
  return `${MYOB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  businessId: string,
  redirectUri: string
): Promise<MyobTokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.MYOB_CLIENT_ID ?? "",
    client_secret: process.env.MYOB_CLIENT_SECRET ?? "",
    scope: "CompanyFile",
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(MYOB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  return (await res.json()) as MyobTokenResponse;
}

async function refreshAccessToken(companyId: string): Promise<string> {
  const [tokenRow] = await db.select().from(myobTokens).where(eq(myobTokens.companyId, companyId)).limit(1);
  if (!tokenRow) {
    throw new Error("No MYOB connection found. Complete OAuth flow first.");
  }

  const body = new URLSearchParams({
    client_id: process.env.MYOB_CLIENT_ID ?? "",
    client_secret: process.env.MYOB_CLIENT_SECRET ?? "",
    refresh_token: tokenRow.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(MYOB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as MyobTokenResponse;
  const expiresIn = parseInt(data.expires_in, 10) || 1200;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await db.update(myobTokens)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokenRow.refreshToken,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(myobTokens.companyId, companyId));

  return data.access_token;
}

export async function getValidAccessToken(companyId: string): Promise<{ accessToken: string; businessId: string }> {
  const [tokenRow] = await db.select().from(myobTokens).where(eq(myobTokens.companyId, companyId)).limit(1);
  if (!tokenRow) {
    throw new Error("No MYOB connection found. Complete OAuth flow first.");
  }

  const bufferMs = 60 * 1000;
  if (tokenRow.expiresAt.getTime() > Date.now() + bufferMs) {
    return { accessToken: tokenRow.accessToken, businessId: tokenRow.businessId };
  }

  const accessToken = await refreshAccessToken(companyId);
  return { accessToken, businessId: tokenRow.businessId };
}

function encodeCfToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`, "utf-8").toString("base64");
}

export async function myobFetch<T = unknown>(
  companyId: string,
  endpoint: string,
  options: RequestInit = {},
  _retried = false
): Promise<T> {
  const { accessToken, businessId } = await getValidAccessToken(companyId);

  const cfToken = encodeCfToken(
    process.env.MYOB_CF_USERNAME ?? "",
    process.env.MYOB_CF_PASSWORD ?? ""
  );

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${MYOB_API_BASE}/${businessId}/${endpoint.replace(/^\//, "")}`;

  const method = (options.method ?? "GET").toUpperCase();
  logger.info({ method, url }, "[MYOB API] Request");

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-myobapi-cftoken": cfToken,
      "x-myobapi-key": process.env.MYOB_API_KEY ?? "",
      "x-myobapi-version": "v2",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await res.text();

  if (res.status === 401 && !_retried) {
    logger.warn("[MYOB API] Got 401, forcing token refresh and retrying...");
    try {
      await refreshAccessToken(companyId);
      return myobFetch<T>(companyId, endpoint, options, true);
    } catch (refreshErr) {
      const refreshMsg = refreshErr instanceof Error ? refreshErr.message : "Unknown refresh error";
      logger.error({ err: refreshMsg }, "[MYOB API] Token refresh failed after 401");
      throw new Error(`MYOB authentication failed. Please disconnect and reconnect your MYOB account in Settings. Details: ${refreshMsg}`);
    }
  }

  if (!res.ok) {
    logger.error({ status: res.status, body: text.slice(0, 500) }, "[MYOB API] Error");
    throw new Error(`MYOB API error ${res.status}: ${text}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

export function createMyobClient(companyId: string) {
  return {
    getCompany: () => myobFetch(companyId, "Company/"),
    getCustomers: (query?: string) => myobFetch(companyId, `Contact/Customer/${query ? `?${query}` : ""}`),
    getSuppliers: (query?: string) => myobFetch(companyId, `Contact/Supplier/${query ? `?${query}` : ""}`),
    getAccounts: (query?: string) => myobFetch(companyId, `GeneralLedger/Account/${query ? `?${query}` : ""}`),
    getInvoices: (query?: string) => myobFetch(companyId, `Sale/Invoice/${query ? `?${query}` : ""}`),
    getItems: (query?: string) => myobFetch(companyId, `Inventory/Item/${query ? `?${query}` : ""}`),
    createPurchaseBill: (bill: any) => myobFetch(companyId, "Purchase/Bill/Service", {
      method: "POST",
      body: JSON.stringify(bill),
    }),
    getProfitAndLoss: (params: string) => myobFetch(companyId, `Report/ProfitAndLossSummary?${params}`),
  };
}

export async function storeTokens(
  companyId: string,
  userId: string,
  data: MyobTokenResponse,
  businessId: string
): Promise<void> {
  const expiresIn = parseInt(data.expires_in, 10) || 1200;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  const [existing] = await db.select({ id: myobTokens.id }).from(myobTokens).where(eq(myobTokens.companyId, companyId)).limit(1);

  if (existing) {
    await db.update(myobTokens)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        businessId,
        connectedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(myobTokens.companyId, companyId));
  } else {
    await db.insert(myobTokens).values({
      companyId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      businessId,
      connectedBy: userId,
    });
  }
}

export async function getConnectionStatus(companyId: string) {
  const [tokenRow] = await db.select({
    id: myobTokens.id,
    businessId: myobTokens.businessId,
    connectedBy: myobTokens.connectedBy,
    expiresAt: myobTokens.expiresAt,
    createdAt: myobTokens.createdAt,
    updatedAt: myobTokens.updatedAt,
  }).from(myobTokens).where(eq(myobTokens.companyId, companyId)).limit(1);

  if (!tokenRow) {
    return { connected: false as const };
  }

  return {
    connected: true as const,
    businessId: tokenRow.businessId,
    connectedBy: tokenRow.connectedBy,
    expiresAt: tokenRow.expiresAt,
    connectedAt: tokenRow.createdAt,
    lastRefreshed: tokenRow.updatedAt,
  };
}

export async function disconnectMyob(companyId: string): Promise<void> {
  await db.delete(myobTokens).where(eq(myobTokens.companyId, companyId));
}
