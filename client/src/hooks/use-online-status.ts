import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const { toast } = useToast();

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    toast({
      title: "Back online",
      description: "Your connection has been restored.",
    });
  }, [toast]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    toast({
      title: "You are offline",
      description: "Some features may be unavailable until your connection is restored.",
      variant: "destructive",
    });
  }, [toast]);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}
