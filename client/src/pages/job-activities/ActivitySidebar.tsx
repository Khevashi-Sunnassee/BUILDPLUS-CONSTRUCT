import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { dateInputProps } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Clock, User, FileText, Loader2, Send, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_ACTIVITIES_ROUTES } from "@shared/api-routes";
import { format } from "date-fns";
import {
  type ActivityWithAssignees,
  STATUS_OPTIONS,
  isDatePast,
} from "@/lib/activity-constants";

interface ActivitySidebarProps {
  activity: ActivityWithAssignees | null;
  onClose: () => void;
  jobId: string;
  users: Record<string, unknown>[];
  allParentActivities: ActivityWithAssignees[];
}

export function ActivitySidebar({
  activity,
  onClose,
  jobId,
  users,
  allParentActivities,
}: ActivitySidebarProps) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  const { data: updates, isLoading: loadingUpdates } = useQuery<{ id: string; userId: string; content: string; createdAt: string }[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity.id) : ""],
    enabled: !!activity,
  });

  const { data: files, isLoading: loadingFiles } = useQuery<{ id: string; fileName: string; fileUrl: string; fileSize?: number }[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity.id) : ""],
    enabled: !!activity,
  });

  const { data: checklistItems = [] } = useQuery<{ id: string; label: string; isChecked: boolean; checkedByName?: string }[]>({
    queryKey: [activity ? PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLISTS(activity.id) : ""],
    enabled: !!activity && (activity.checklistTotal || 0) > 0,
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLIST_TOGGLE(checklistId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_CHECKLISTS(activity!.id)] });
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const postUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity!.id), { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_UPDATES(activity!.id)] });
      setCommentText("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity!.id), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.ACTIVITY_FILES(activity!.id)] });
      toast({ title: "File uploaded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES_RECALCULATE(jobId), {});
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, _recalculate, ...data }: Record<string, unknown> & { id: string; _recalculate?: boolean }) => {
      const res = await apiRequest("PATCH", PROJECT_ACTIVITIES_ROUTES.ACTIVITY_BY_ID(id), data);
      return { res, _recalculate };
    },
    onSuccess: async ({ _recalculate }: { res: Response; _recalculate?: boolean }) => {
      await queryClient.invalidateQueries({ queryKey: [PROJECT_ACTIVITIES_ROUTES.JOB_ACTIVITIES(jobId)] });
      if (_recalculate) {
        recalculateMutation.mutate();
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function getUserName(userId: string) {
    const user = users?.find(u => u.id === userId);
    return (user?.name as string) || (user?.email as string) || "Unknown";
  }

  function getUserInitials(userId: string) {
    const name = getUserName(userId);
    return name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  }

  if (!activity) return null;

  return (
    <Sheet open={!!activity} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle data-testid="text-sidebar-activity-name">{activity.name}</SheetTitle>
          <SheetDescription>
            {activity.category && <Badge variant="outline" className="mr-2">{activity.category}</Badge>}
            {activity.jobPhase && <Badge variant="secondary">{activity.jobPhase}</Badge>}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1" data-testid="tab-details">Details</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1" data-testid="tab-chat">
              Chat {updates && updates.length > 0 && <Badge variant="secondary" className="ml-1">{updates.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="files" className="flex-1" data-testid="tab-files">
              Files {files && files.length > 0 && <Badge variant="secondary" className="ml-1">{files.length}</Badge>}
            </TabsTrigger>
            {(activity.checklistTotal || 0) > 0 && (
              <TabsTrigger value="checklist" className="flex-1" data-testid="tab-checklist">
                Checklist <Badge variant="secondary" className="ml-1">{activity.checklistCompleted}/{activity.checklistTotal}</Badge>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Select
                  value={activity.status}
                  onValueChange={(v) => updateActivityMutation.mutate({ id: activity.id, status: v })}
                >
                  <SelectTrigger data-testid="sidebar-select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className={`text-xs ${isDatePast(activity.startDate, activity.status) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>Start Date</Label>
                  <Input
                    type="date"
                    {...dateInputProps}
                    className={isDatePast(activity.startDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}
                    value={activity.startDate ? format(new Date(activity.startDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateActivityMutation.mutate({ id: activity.id, startDate: e.target.value || null, _recalculate: true })}
                    data-testid="sidebar-input-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className={`text-xs ${isDatePast(activity.endDate, activity.status) ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>End Date</Label>
                  <Input
                    type="date"
                    {...dateInputProps}
                    className={isDatePast(activity.endDate, activity.status) ? "border-red-500 text-red-600 dark:text-red-400" : ""}
                    value={activity.endDate ? format(new Date(activity.endDate), "yyyy-MM-dd") : ""}
                    onChange={(e) => updateActivityMutation.mutate({ id: activity.id, endDate: e.target.value || null })}
                    data-testid="sidebar-input-end-date"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Reminder Date</Label>
                <Input
                  type="date"
                  {...dateInputProps}
                  value={activity.reminderDate ? format(new Date(activity.reminderDate), "yyyy-MM-dd") : ""}
                  onChange={(e) => updateActivityMutation.mutate({ id: activity.id, reminderDate: e.target.value || null })}
                  data-testid="sidebar-input-reminder"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Estimated Days</Label>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {activity.estimatedDays || "-"} days
                </div>
              </div>

              {!activity.parentId && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Predecessor</Label>
                    <Select
                      value={activity.predecessorSortOrder != null ? String(activity.predecessorSortOrder) : "none"}
                      onValueChange={(v) => {
                        const predOrder = v === "none" ? null : parseInt(v);
                        const rel = predOrder != null ? (activity.relationship || "FS") : null;
                        updateActivityMutation.mutate({ id: activity.id, predecessorSortOrder: predOrder, relationship: rel, _recalculate: true });
                      }}
                    >
                      <SelectTrigger data-testid="sidebar-select-predecessor">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {allParentActivities
                          .filter(a => a.sortOrder < activity.sortOrder)
                          .map(a => (
                            <SelectItem key={a.id} value={String(a.sortOrder)}>
                              {a.sortOrder}. {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Relationship</Label>
                    <Select
                      value={activity.relationship || "FS"}
                      onValueChange={(v) => {
                        updateActivityMutation.mutate({ id: activity.id, relationship: v, _recalculate: true });
                      }}
                      disabled={activity.predecessorSortOrder == null}
                    >
                      <SelectTrigger data-testid="sidebar-select-relationship">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FS">FS (Finish-to-Start)</SelectItem>
                        <SelectItem value="SS">SS (Start-to-Start)</SelectItem>
                        <SelectItem value="FF">FF (Finish-to-Finish)</SelectItem>
                        <SelectItem value="SF">SF (Start-to-Finish)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Consultant</Label>
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {activity.consultantName || "-"}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Deliverable</Label>
                <div className="flex items-center gap-1 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {activity.deliverable || "-"}
                </div>
              </div>

              {activity.notes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Notes</Label>
                  <p className="text-sm">{activity.notes}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Notes</Label>
                <Textarea
                  value={activity.notes || ""}
                  onChange={(e) => updateActivityMutation.mutate({ id: activity.id, notes: e.target.value })}
                  placeholder="Add notes..."
                  className="text-sm"
                  data-testid="sidebar-textarea-notes"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-3">
                {loadingUpdates ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : updates && updates.length > 0 ? (
                  updates.map((update) => (
                    <div key={update.id} className="flex gap-2" data-testid={`update-${update.id}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{getUserInitials(update.userId)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{getUserName(update.userId)}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(update.createdAt), "dd MMM yyyy HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{update.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-8">No comments yet</p>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-3">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && commentText.trim()) {
                    e.preventDefault();
                    postUpdateMutation.mutate(commentText.trim());
                  }
                }}
                data-testid="input-comment"
              />
              <Button
                size="icon"
                onClick={() => commentText.trim() && postUpdateMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || postUpdateMutation.isPending}
                aria-label="Send comment"
                data-testid="button-send-comment"
              >
                {postUpdateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) uploadFileMutation.mutate(file);
                  };
                  input.click();
                }}
                disabled={uploadFileMutation.isPending}
                data-testid="button-upload-file"
              >
                {uploadFileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                Upload File
              </Button>

              {loadingFiles ? (
                <Skeleton className="h-20 w-full" />
              ) : files && files.length > 0 ? (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-2 p-2 border rounded" data-testid={`file-${file.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">
                            {file.fileName}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground text-sm py-8">No files attached</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            <div className="space-y-2">
              {checklistItems.length > 0 ? checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 border rounded cursor-pointer hover-elevate"
                  onClick={() => toggleChecklistMutation.mutate(item.id)}
                  data-testid={`checklist-item-${item.id}`}
                >
                  <Checkbox
                    checked={item.isChecked}
                    onCheckedChange={() => toggleChecklistMutation.mutate(item.id)}
                    data-testid={`checklist-checkbox-${item.id}`}
                  />
                  <span className={cn("text-sm flex-1", item.isChecked && "line-through text-muted-foreground")}>
                    {item.label}
                  </span>
                  {item.checkedByName && (
                    <span className="text-xs text-muted-foreground">{item.checkedByName}</span>
                  )}
                </div>
              )) : (
                <p className="text-center text-muted-foreground text-sm py-8">No checklist items</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
