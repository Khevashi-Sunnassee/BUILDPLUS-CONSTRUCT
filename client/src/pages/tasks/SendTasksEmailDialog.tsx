import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, startOfDay } from "date-fns";
import { TASKS_ROUTES } from "@shared/api-routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  Send,
  Mail,
  Loader2,
} from "lucide-react";
import type { Task, User } from "./types";
import { STATUS_CONFIG } from "./types";

export function SendTasksEmailDialog({
  open,
  onOpenChange,
  selectedTasks,
  users,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTasks: Task[];
  users: User[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [additionalEmail, setAdditionalEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendCopy, setSendCopy] = useState(false);

  const buildTaskList = useCallback((tasks: Task[]) => {
    return tasks.map((t) => {
      const assigneeNames = (t.assignees || []).map(a => a.user?.name || a.user?.email || "Unassigned").join(", ");
      const dueStr = t.dueDate ? format(new Date(t.dueDate), "dd/MM/yyyy") : "No due date";
      const statusLabel = STATUS_CONFIG[t.status]?.label || t.status;
      return `- ${t.title} | Status: ${statusLabel} | Due: ${dueStr} | Assigned: ${assigneeNames}`;
    }).join("\n");
  }, []);

  useEffect(() => {
    if (open && selectedTasks.length > 0) {
      const assigneeEmails = new Set<string>();
      selectedTasks.forEach((t) => {
        (t.assignees || []).forEach((a) => {
          if (a.user?.email) assigneeEmails.add(a.user.email);
        });
      });
      setToEmails(Array.from(assigneeEmails));
      setAdditionalEmail("");
      setCcEmail("");
      setSendCopy(false);
      setSubject(`Task Follow-up - ${selectedTasks.length} task${selectedTasks.length !== 1 ? "s" : ""}`);
      setMessage(
        `Hi,\n\nThis is a follow-up on the following tasks:\n\n${buildTaskList(selectedTasks)}\n\nPlease review and update as needed.\n\nKind regards`
      );
    }
  }, [open, selectedTasks, buildTaskList]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", TASKS_ROUTES.SEND_EMAIL, {
        to: toEmails.join(", "),
        cc: ccEmail || undefined,
        subject,
        message,
        sendCopy,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Task follow-up emailed to ${toEmails.length} recipient${toEmails.length !== 1 ? "s" : ""}` });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: any) => {
      let errorMsg = err.message || "An error occurred";
      try {
        const jsonMatch = errorMsg.match(/\d+:\s*(\{.*\})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          errorMsg = parsed.error || errorMsg;
        }
      } catch {}
      toast({ title: "Failed to send email", description: errorMsg, variant: "destructive" });
    },
  });

  const handleAddEmail = () => {
    const email = additionalEmail.trim();
    if (email && !toEmails.includes(email)) {
      setToEmails([...toEmails, email]);
      setAdditionalEmail("");
    }
  };

  const handleRemoveEmail = (email: string) => {
    setToEmails(toEmails.filter((e) => e !== email));
  };

  const handleSend = () => {
    if (toEmails.length === 0) {
      toast({ title: "Recipients required", description: "Please add at least one recipient email address", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden" data-testid="dialog-send-tasks-email">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="text-tasks-email-dialog-title">
            <Mail className="h-5 w-5" />
            Email Task Follow-up
          </DialogTitle>
          <DialogDescription>
            Send follow-up email for {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="w-[420px] flex-shrink-0 border-r overflow-y-auto p-6 space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <div className="flex flex-wrap gap-1 p-2 min-h-[38px] border rounded-md bg-background">
                {toEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1" data-testid={`badge-to-email-${email}`}>
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`btn-remove-email-${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  type="email"
                  placeholder="Add email..."
                  value={additionalEmail}
                  onChange={(e) => setAdditionalEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  onBlur={handleAddEmail}
                  className="flex-1 min-w-[150px] h-7 border-0 shadow-none focus-visible:ring-0 text-sm"
                  data-testid="input-task-email-add"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Quick add from team:</p>
                <div className="flex flex-wrap gap-1">
                  {users
                    .filter((u) => u.email && !toEmails.includes(u.email))
                    .slice(0, 6)
                    .map((u) => (
                      <Badge
                        key={u.id}
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => u.email && setToEmails([...toEmails, u.email])}
                        data-testid={`btn-quick-add-${u.id}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {u.name || u.email}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-email-cc">Cc</Label>
              <Input
                id="task-email-cc"
                type="email"
                placeholder="cc@example.com"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                data-testid="input-task-email-cc"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-email-subject">Subject</Label>
              <Input
                id="task-email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="input-task-email-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-email-message">Message</Label>
              <Textarea
                id="task-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={12}
                className="resize-none text-sm"
                data-testid="input-task-email-message"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="task-send-copy"
                  checked={sendCopy}
                  onCheckedChange={(v) => setSendCopy(!!v)}
                  data-testid="checkbox-task-send-copy"
                />
                <Label htmlFor="task-send-copy" className="text-sm cursor-pointer">Send myself a copy</Label>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task-email">
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sendMutation.isPending} data-testid="button-send-task-email">
                {sendMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send email
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
            <div className="flex border-b px-4">
              <div className="px-4 py-2.5 text-sm font-medium border-b-2 border-primary text-foreground">
                Email Preview
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <Card className="max-w-md mx-auto" data-testid="card-task-email-preview">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center space-y-1">
                    <p className="text-lg font-semibold">Task Follow-up</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""} included
                    </p>
                  </div>
                  <Separator />
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {message}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks Summary</p>
                    {selectedTasks.map((t) => (
                      <div key={t.id} className="p-2 rounded-md bg-muted/50 border text-sm space-y-1" data-testid={`email-task-${t.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium flex-1 truncate">{t.title}</span>
                          <div className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white", STATUS_CONFIG[t.status]?.bgClass)}>
                            {STATUS_CONFIG[t.status]?.label}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className={cn(t.dueDate && isBefore(new Date(t.dueDate), startOfDay(new Date())) && t.status !== "DONE" && "text-red-500")}>Due: {t.dueDate ? format(new Date(t.dueDate), "dd/MM/yyyy") : "No date"}</span>
                          <span>
                            Assigned: {(t.assignees || []).map(a => a.user?.name || "?").join(", ") || "Unassigned"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
