import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User } from "@shared/schema";
import { AUTH_ROUTES } from "@shared/api-routes";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch(AUTH_ROUTES.ME, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(AUTH_ROUTES.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    await fetchUser();
  };

  const logout = async () => {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
    await fetch(AUTH_ROUTES.LOGOUT, {
      method: "POST",
      credentials: "include",
      headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
