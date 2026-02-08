import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HelpEntry } from "@shared/schema";

interface HelpContextValue {
  drawerOpen: boolean;
  drawerKey: string | null;
  openDrawer: (key: string) => void;
  closeDrawer: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  const openDrawer = useCallback((key: string) => {
    setDrawerKey(key);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerKey(null);
  }, []);

  return (
    <HelpContext.Provider value={{ drawerOpen, drawerKey, openDrawer, closeDrawer }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelpContext() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelpContext must be used within HelpProvider");
  return ctx;
}

export function useHelp(key: string | null) {
  return useQuery<HelpEntry>({
    queryKey: ["/api/help", key],
    queryFn: async () => {
      if (!key) return null;
      const res = await fetch(`/api/help?key=${encodeURIComponent(key)}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!key,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
