import { Check, X, Clock, ChevronRight, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import type { CapexApprovalEntry } from "./types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRequiredApprovalCount(totalCost: number): number {
  if (totalCost > 50000) return 3;
  if (totalCost >= 5000) return 2;
  return 1;
}

function getTierLabel(required: number): string {
  if (required === 1) return "Under $5,000 — 1 approval needed";
  if (required === 2) return "$5,000–$50,000 — 2 approvals needed";
  return "Over $50,000 — 3 approvals needed";
}

interface ApprovalTimelineProps {
  status: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  approvals?: CapexApprovalEntry[] | null;
  approvalsRequired?: number | null;
  totalEquipmentCost?: string | null;
}

export function ApprovalTimeline({ status, submittedAt, approvedAt, rejectedAt, approvals, approvalsRequired, totalEquipmentCost }: ApprovalTimelineProps) {
  const totalCost = parseFloat(totalEquipmentCost || "0");
  const required = approvalsRequired || getRequiredApprovalCount(totalCost);
  const approvalList: CapexApprovalEntry[] = (approvals || []) as CapexApprovalEntry[];
  const completedCount = approvalList.length;
  const isSubmitted = ["SUBMITTED", "APPROVED", "REJECTED"].includes(status);
  const isFullyApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";

  return (
    <div className="space-y-3" data-testid="approval-timeline">
      <div className="flex items-center gap-2 py-2">
        <div className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`}>
          <Check className="h-3 w-3" />
          Draft
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
          isSubmitted ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-muted text-muted-foreground"
        }`}>
          {isSubmitted ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          Submitted
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
          isRejected ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
          isFullyApproved ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
          "bg-muted text-muted-foreground"
        }`}>
          {isRejected ? <X className="h-3 w-3" /> : isFullyApproved ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {isRejected ? "Rejected" : "Approved"}
        </div>
      </div>

      {isSubmitted && (
        <div className="border rounded-lg p-3 bg-card" data-testid="approval-chain-progress">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" data-testid="text-approval-progress">
              {isFullyApproved
                ? `All ${required} approval${required > 1 ? "s" : ""} complete`
                : isRejected
                  ? "Request rejected"
                  : `Approval ${completedCount}/${required} complete`}
            </span>
            <span className="text-xs text-muted-foreground" data-testid="text-approval-tier">
              {getTierLabel(required)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: required }).map((_, i) => {
              const approval = approvalList[i];
              const isDone = !!approval;
              const isPending = !approval && !isRejected;

              return (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`w-6 h-0.5 ${isDone ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div data-testid={`approval-slot-${i + 1}`}>
                        <Avatar className={`h-8 w-8 border-2 ${
                          isDone ? "border-green-500" : isPending ? "border-muted-foreground/30" : "border-red-500"
                        }`}>
                          <AvatarFallback className={`text-xs ${
                            isDone ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                            isPending ? "bg-muted text-muted-foreground" :
                            "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                          }`}>
                            {isDone ? getInitials(approval.userName) : <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isDone ? (
                        <div className="text-xs">
                          <div className="font-medium">{approval.userName}</div>
                          <div>Level {approval.level} approval</div>
                          <div>{formatDistanceToNow(new Date(approval.timestamp), { addSuffix: true })}</div>
                          {approval.comments && <div className="mt-1 italic">"{approval.comments}"</div>}
                        </div>
                      ) : (
                        <span className="text-xs">Awaiting Level {i + 1} approval</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>

          {completedCount > 0 && (
            <div className="mt-2 space-y-1">
              {approvalList.map((approval) => (
                <div key={approval.userId} className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`approval-entry-${approval.level}`}>
                  <Check className="h-3 w-3 text-green-600" />
                  <span className="font-medium text-foreground">{approval.userName}</span>
                  <span>— Level {approval.level}</span>
                  <span>· {formatDistanceToNow(new Date(approval.timestamp), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
