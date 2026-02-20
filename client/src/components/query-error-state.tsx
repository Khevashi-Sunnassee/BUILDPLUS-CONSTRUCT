import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  error: Error | null;
  onRetry?: () => void;
  message?: string;
  compact?: boolean;
}

export function QueryErrorState({ error, onRetry, message, compact = false }: QueryErrorStateProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm" data-testid="query-error-compact" role="alert">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{message || "Failed to load data"}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 px-2" data-testid="button-retry-compact">
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 gap-4" data-testid="query-error-state" role="alert">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">{message || "Failed to load data"}</p>
        {error?.message && (
          <p className="text-xs text-muted-foreground max-w-md">{error.message}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}
