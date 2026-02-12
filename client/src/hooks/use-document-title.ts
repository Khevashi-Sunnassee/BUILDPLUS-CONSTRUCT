import { useEffect } from "react";

const BASE_TITLE = "BuildPlus Ai";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
