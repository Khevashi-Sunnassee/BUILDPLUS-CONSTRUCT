import { QueryClient, QueryFunction } from "@tanstack/react-query";

export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function apiUpload(
  url: string,
  formData: FormData,
): Promise<Response> {
  const token = getCsrfToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["x-csrf-token"] = token;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
  await throwIfResNotOk(res);
  return res;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  const upperMethod = method.toUpperCase();
  if (upperMethod !== "GET" && upperMethod !== "HEAD" && upperMethod !== "OPTIONS") {
    const token = getCsrfToken();
    if (token) {
      headers["x-csrf-token"] = token;
    }
  }
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey - handle query parameters if second element is an object
    let url = queryKey[0] as string;
    
    if (queryKey.length > 1) {
      const lastElement = queryKey[queryKey.length - 1];
      if (typeof lastElement === 'object' && lastElement !== null) {
        // Last element is query params object
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(lastElement)) {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        }
        const paramString = params.toString();
        if (paramString) {
          url = `${url}?${paramString}`;
        }
      } else {
        // Join path segments
        url = queryKey.filter(k => typeof k === 'string').join("/");
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
