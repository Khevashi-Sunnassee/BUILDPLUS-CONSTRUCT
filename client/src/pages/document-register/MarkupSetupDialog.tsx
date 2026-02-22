import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MarkupSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkupSetupDialog({ open, onOpenChange }: MarkupSetupDialogProps) {
  const { toast } = useToast();
  const [markupAppUrl, setMarkupAppUrl] = useState("");
  const [markupEmail, setMarkupEmail] = useState("");
  const [markupApiKey, setMarkupApiKey] = useState("");

  const credentialsQuery = useQuery<{ id: string; markupAppUrl: string; markupEmail: string; markupApiKey?: string } | null>({
    queryKey: ["/api/markup-credentials"],
  });

  useEffect(() => {
    if (credentialsQuery.data) {
      setMarkupAppUrl(credentialsQuery.data.markupAppUrl || "");
      setMarkupEmail(credentialsQuery.data.markupEmail || "");
      setMarkupApiKey("");
    }
  }, [credentialsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/markup-credentials", {
        markupAppUrl: markupAppUrl.replace(/\/+$/, ""),
        markupEmail,
        markupApiKey: markupApiKey || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Markup connection configured successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/markup-credentials"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/markup-credentials");
    },
    onSuccess: () => {
      toast({ title: "Removed", description: "Markup connection removed" });
      setMarkupAppUrl("");
      setMarkupEmail("");
      setMarkupApiKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/markup-credentials"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const hasExisting = !!credentialsQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-markup-setup">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            BuildPlus Markup Connection
          </DialogTitle>
          <DialogDescription>
            Connect to your BuildPlus Markup app to open documents for markup directly from the document register.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="markupAppUrl">Markup App URL</Label>
            <Input
              id="markupAppUrl"
              placeholder="https://your-markup-app.replit.app"
              value={markupAppUrl}
              onChange={(e) => setMarkupAppUrl(e.target.value)}
              data-testid="input-markup-url"
            />
            <p className="text-xs text-muted-foreground">The URL of your BuildPlus Markup Replit app</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="markupEmail">Your Email in Markup App</Label>
            <Input
              id="markupEmail"
              type="email"
              placeholder="you@company.com"
              value={markupEmail}
              onChange={(e) => setMarkupEmail(e.target.value)}
              data-testid="input-markup-email"
            />
            <p className="text-xs text-muted-foreground">The email you use to log in to BuildPlus Markup</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="markupApiKey">API Key (Optional)</Label>
            <Input
              id="markupApiKey"
              type="password"
              placeholder={hasExisting ? "••••••••" : "Optional API key for authentication"}
              value={markupApiKey}
              onChange={(e) => setMarkupApiKey(e.target.value)}
              data-testid="input-markup-api-key"
            />
            <p className="text-xs text-muted-foreground">API key from your Markup app for enhanced security</p>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {hasExisting && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-remove-markup"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-markup">
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!markupAppUrl || !markupEmail || saveMutation.isPending}
              data-testid="button-save-markup"
            >
              {saveMutation.isPending ? "Saving..." : hasExisting ? "Update" : "Connect"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
