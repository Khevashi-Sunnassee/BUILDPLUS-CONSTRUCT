import { Check, X, Clock, ChevronRight } from "lucide-react";

export function ApprovalTimeline({ status, submittedAt, approvedAt, rejectedAt }: { status: string; submittedAt?: string | null; approvedAt?: string | null; rejectedAt?: string | null }) {
  const steps = [
    { label: "Draft", done: true },
    { label: "Submitted", done: ["SUBMITTED", "APPROVED", "REJECTED"].includes(status) },
    { label: status === "REJECTED" ? "Rejected" : "Approved", done: ["APPROVED", "REJECTED"].includes(status), isRejected: status === "REJECTED" },
  ];
  return (
    <div className="flex items-center gap-2 py-3" data-testid="approval-timeline">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium ${
            step.isRejected ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
            step.done ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
            "bg-muted text-muted-foreground"
          }`}>
            {step.done ? (step.isRejected ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />) : <Clock className="h-3 w-3" />}
            {step.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}
