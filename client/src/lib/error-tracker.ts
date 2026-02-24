interface ErrorEvent {
  message: string;
  source?: string;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  componentStack?: string;
}

const MAX_ERRORS = 100;
const errorLog: ErrorEvent[] = [];

function createErrorEvent(error: Error | string, source?: string, componentStack?: string): ErrorEvent {
  const err = typeof error === "string" ? new Error(error) : error;
  return {
    message: err.message,
    source: source || "unknown",
    stack: err.stack?.slice(0, 2000),
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    componentStack: componentStack?.slice(0, 1000),
  };
}

export function trackError(error: Error | string, source?: string, componentStack?: string) {
  const event = createErrorEvent(error, source, componentStack);
  errorLog.push(event);
  if (errorLog.length > MAX_ERRORS) {
    errorLog.splice(0, errorLog.length - MAX_ERRORS);
  }

  try {
    const stored = JSON.parse(sessionStorage.getItem("error_log") || "[]");
    stored.push(event);
    if (stored.length > 20) stored.splice(0, stored.length - 20);
    sessionStorage.setItem("error_log", JSON.stringify(stored));
  } catch {
  }
}

export function getErrorLog(): ErrorEvent[] {
  return [...errorLog];
}

export function clearErrorLog() {
  errorLog.length = 0;
  try {
    sessionStorage.removeItem("error_log");
  } catch {
  }
}

let globalTrackingInitialized = false;

export function initGlobalErrorTracking() {
  if (globalTrackingInitialized) return;
  globalTrackingInitialized = true;

  window.addEventListener("error", (event) => {
    trackError(
      event.error || event.message || "Unknown error",
      `global:${event.filename || "unknown"}:${event.lineno || 0}`
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    trackError(reason, "unhandled-promise");
  });
}
