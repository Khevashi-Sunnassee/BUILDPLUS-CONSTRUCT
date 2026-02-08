import { useEffect, useCallback, useRef } from "react";

export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (isDirtyRef.current) {
      e.preventDefault();
      e.returnValue = "";
    }
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleBeforeUnload]);
}
