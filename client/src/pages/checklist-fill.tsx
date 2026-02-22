import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { PageHelpButton } from "@/components/help/page-help-button";
import { Link } from "wouter";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  Send,
  AlertCircle,
  Clock,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChecklistForm, calculateCompletionRate, getMissingRequiredFields } from "@/components/checklist/checklist-form";
import type { ChecklistInstance, ChecklistTemplate } from "@shared/schema";
import { CHECKLIST_ROUTES } from "@shared/api-routes";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "secondary", icon: FileText },
  in_progress: { label: "In Progress", variant: "default", icon: Clock },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle },
  signed_off: { label: "Signed Off", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: AlertCircle },
};

export default function ChecklistFillPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const { data: instance, isLoading: instanceLoading } = useQuery<ChecklistInstance>({
    queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)],
    enabled: !!id,
  });

  const { data: template, isLoading: templateLoading } = useQuery<ChecklistTemplate>({
    queryKey: [CHECKLIST_ROUTES.TEMPLATE_BY_ID(instance?.templateId || "")],
    enabled: !!instance?.templateId,
  });

  useEffect(() => {
    if (instance?.responses) {
      setResponses(instance.responses as Record<string, unknown>);
    }
  }, [instance]);

  const saveInstanceMutation = useMutation({
    mutationFn: async () => {
      const completionRate = template ? calculateCompletionRate(template, responses) : 0;
      return apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(id!), {
        responses,
        completionRate: completionRate.toFixed(2),
        status: instance?.status === "draft" ? "in_progress" : instance?.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)] });
      setHasChanges(false);
      toast({ title: "Saved", description: "Your progress has been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save progress", variant: "destructive" });
    },
  });

  const completeInstanceMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", CHECKLIST_ROUTES.INSTANCE_BY_ID(id!), {
        responses,
        completionRate: "100",
      });
      return apiRequest("PATCH", CHECKLIST_ROUTES.INSTANCE_COMPLETE(id!));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCES] });
      queryClient.invalidateQueries({ queryKey: [CHECKLIST_ROUTES.INSTANCE_BY_ID(id!)] });
      setHasChanges(false);
      setCompleteDialogOpen(false);
      toast({ title: "Completed", description: "Checklist has been marked as complete" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete checklist", variant: "destructive" });
    },
  });

  const handleResponseChange = useCallback((newResponses: Record<string, unknown>) => {
    setResponses(newResponses);
    setHasChanges(true);
  }, []);

  const handleComplete = useCallback(() => {
    if (!template) return;
    const missing = getMissingRequiredFields(template, responses);
    if (missing.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please complete: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`,
        variant: "destructive",
      });
      return;
    }
    setCompleteDialogOpen(true);
  }, [template, responses, toast]);

  const isLoading = instanceLoading || templateLoading;
  const isCompleted = useMemo(() => instance?.status === "completed" || instance?.status === "signed_off", [instance?.status]);
  const statusConfig = useMemo(() => instance?.status ? STATUS_CONFIG[instance.status] : null, [instance?.status]);

  if (isLoading) {
    return (
      <div className="space-y-6" role="main" aria-label="Checklist Fill">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!instance || !template) {
    return (
      <div className="space-y-6" role="main" aria-label="Checklist Fill">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Checklist Not Found</h3>
          <p className="text-muted-foreground mb-4">
            The checklist you're looking for doesn't exist or you don't have access.
          </p>
          <Button asChild data-testid="button-back-to-checklists">
            <Link href="/checklists">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Checklists
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="main" aria-label="Checklist Fill">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild data-testid="button-back">
            <Link href="/checklists">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <PageHelpButton pageHelpKey="page.checklist-fill" />
              {statusConfig && (
                <Badge variant={statusConfig.variant}>
                  <statusConfig.icon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{template.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="mr-2">
              Unsaved Changes
            </Badge>
          )}
          {!isCompleted && (
            <>
              <Button
                variant="outline"
                onClick={() => saveInstanceMutation.mutate()}
                disabled={!hasChanges || saveInstanceMutation.isPending}
                data-testid="button-save-checklist"
              >
                {saveInstanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Progress
              </Button>
              <Button
                onClick={handleComplete}
                disabled={completeInstanceMutation.isPending}
                data-testid="button-complete-checklist"
              >
                {completeInstanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {isCompleted && (
        <Alert className="mb-6">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            This checklist has been completed and can no longer be edited.
            {instance.completedAt && (
              <span className="ml-1">
                Completed on {new Date(instance.completedAt).toLocaleDateString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <ChecklistForm
        template={template}
        responses={responses}
        onChange={handleResponseChange}
        disabled={isCompleted}
        showProgress={!isCompleted}
      />

      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Checklist?</AlertDialogTitle>
            <AlertDialogDescription>
              Once completed, this checklist cannot be edited. Make sure all fields are filled correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-complete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeInstanceMutation.mutate()}
              data-testid="button-confirm-complete"
            >
              {completeInstanceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Complete Checklist
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
