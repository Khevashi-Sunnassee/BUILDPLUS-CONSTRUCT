import { useCallback, useEffect } from "react";

interface UseCtrlScrollZoomOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  setZoom: (updater: (prev: number) => number) => void;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
  enabled?: boolean;
}

export function useCtrlScrollZoom({
  containerRef,
  zoom,
  setZoom,
  minZoom = 0.5,
  maxZoom = 5,
  step = 0.1,
  enabled = true,
}: UseCtrlScrollZoomOptions) {
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -step : step;
      setZoom((prev) => Math.min(maxZoom, Math.max(minZoom, prev + delta)));
    },
    [setZoom, minZoom, maxZoom, step]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [containerRef, handleWheel, enabled]);
}
