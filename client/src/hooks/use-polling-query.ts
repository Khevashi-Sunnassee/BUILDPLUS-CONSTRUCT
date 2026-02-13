import { useQuery, UseQueryOptions, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return visible;
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

export function usePollingQuery<T>(
  options: UseQueryOptions<T> & { pollingInterval?: number }
) {
  const { pollingInterval = 30_000, ...queryOptions } = options;
  const isVisible = usePageVisible();
  const isOnline = useOnlineStatus();

  const shouldPoll = isVisible && isOnline;

  return useQuery<T>({
    ...queryOptions,
    refetchInterval: shouldPoll ? pollingInterval : false,
    refetchIntervalInBackground: false,
  });
}

export function useRefreshOnFocus(refetchFn: () => void) {
  const isVisible = usePageVisible();
  const prevVisible = usePrevious(isVisible);

  useEffect(() => {
    if (isVisible && prevVisible === false) {
      refetchFn();
    }
  }, [isVisible, prevVisible, refetchFn]);
}

function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const [current, setCurrent] = useState(value);

  if (value !== current) {
    setPrev(current);
    setCurrent(value);
  }

  return prev;
}
