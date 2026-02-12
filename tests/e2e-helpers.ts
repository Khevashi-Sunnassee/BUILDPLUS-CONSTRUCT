import { beforeAll } from "vitest";

const BASE_URL = "http://localhost:5000";

let adminCookie = "";
let adminCsrfToken = "";
let adminUserId = "";
let adminLoggedIn = false;

let userCookie = "";
let userCsrfToken = "";
let userUserId = "";

export function getAdminUserId() { return adminUserId; }
export function getUserUserId() { return userUserId; }

async function doLogin(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookies = res.headers.getSetCookie?.() || [];
  const sessionCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
  const csrfCookie = cookies.find((c: string) => c.includes("csrf_token"));
  const csrfToken = csrfCookie ? csrfCookie.split("=")[1].split(";")[0] : "";
  const data = await res.json();
  const userId = data.user?.id || "";
  return { sessionCookie, csrfToken, userId };
}

export async function loginAdmin() {
  if (adminLoggedIn && adminCookie) return;
  const result = await doLogin("admin@buildplus.ai", "admin123");
  adminCookie = result.sessionCookie;
  adminCsrfToken = result.csrfToken;
  adminUserId = result.userId;
  adminLoggedIn = true;
}

export async function loginUser() {
  const signupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `e2euser_${Date.now()}@test.com`,
      password: "Test1234!",
      name: "E2E Test User",
      role: "USER",
    }),
  });

  if (signupRes.ok) {
    const cookies = signupRes.headers.getSetCookie?.() || [];
    userCookie = cookies.map((c: string) => c.split(";")[0]).join("; ");
    const csrfCookie = cookies.find((c: string) => c.includes("csrf_token"));
    userCsrfToken = csrfCookie ? csrfCookie.split("=")[1].split(";")[0] : "";
    const data = await signupRes.json();
    userUserId = data.user?.id || "";
  } else {
    const result = await doLogin("admin@buildplus.ai", "admin123");
    userCookie = result.sessionCookie;
    userCsrfToken = result.csrfToken;
    userUserId = result.userId;
  }
}

export async function adminGet(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: adminCookie },
  });
}

export async function adminPost(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "x-csrf-token": adminCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function adminPatch(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "x-csrf-token": adminCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function adminPut(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "x-csrf-token": adminCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function adminDelete(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      Cookie: adminCookie,
      "x-csrf-token": adminCsrfToken,
    },
  });
}

export async function userGet(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: userCookie },
  });
}

export async function userPost(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: userCookie,
      "x-csrf-token": userCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function userPatch(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: userCookie,
      "x-csrf-token": userCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function userDelete(path: string) {
  return fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      Cookie: userCookie,
      "x-csrf-token": userCsrfToken,
    },
  });
}

export async function unauthGet(path: string) {
  return fetch(`${BASE_URL}${path}`);
}

export async function unauthPost(path: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function uniqueName(prefix: string) {
  return `${prefix}_E2E_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
