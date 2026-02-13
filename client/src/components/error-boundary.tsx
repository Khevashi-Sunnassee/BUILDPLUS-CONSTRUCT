import { Component, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { trackError } from "@/lib/error-tracker";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }) {
    console.error("Application error:", error, errorInfo);
    const source = this.props.name ? `error-boundary:${this.props.name}` : "error-boundary";
    trackError(error, source, errorInfo.componentStack || undefined);
    this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4" data-testid="error-boundary">
          <Card className="w-full max-w-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="rounded-full bg-destructive/10 p-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold" data-testid="text-error-title">Something went wrong</h2>
                  <p className="text-sm text-muted-foreground" data-testid="text-error-description">
                    An unexpected error occurred. Please try refreshing the page.
                  </p>
                  {this.state.error && (
                    <p className="text-xs text-muted-foreground/70 font-mono mt-2 p-2 rounded-md bg-muted max-h-24 overflow-auto" data-testid="text-error-details">
                      {this.state.error.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={this.handleReset} data-testid="button-try-again">
                    Try Again
                  </Button>
                  <Button onClick={this.handleReload} data-testid="button-reload">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reload Page
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
