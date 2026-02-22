export const JOB_PHASES = [
  "OPPORTUNITY",
  "QUOTING",
  "WON_AWAITING_CONTRACT",
  "CONTRACTED",
  "LOST",
] as const;

export type JobPhase = (typeof JOB_PHASES)[number];

export const JOB_STATUSES = [
  "ACTIVE",
  "ON_HOLD",
  "PENDING_START",
  "STARTED",
  "COMPLETED",
  "DEFECT_LIABILITY_PERIOD",
  "ARCHIVED",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const PHASE_ALLOWED_STATUSES: Record<JobPhase, readonly JobStatus[]> = {
  OPPORTUNITY: ["ACTIVE", "ON_HOLD"],
  QUOTING: ["ACTIVE", "ON_HOLD"],
  WON_AWAITING_CONTRACT: ["ACTIVE", "ON_HOLD", "PENDING_START", "STARTED"],
  CONTRACTED: ["ACTIVE", "ON_HOLD", "PENDING_START", "STARTED", "COMPLETED", "DEFECT_LIABILITY_PERIOD", "ARCHIVED"],
  LOST: ["ARCHIVED"],
};

export const PHASE_LABELS: Record<JobPhase, string> = {
  OPPORTUNITY: "Opportunity",
  QUOTING: "Quoting",
  WON_AWAITING_CONTRACT: "Won Awaiting Contract",
  CONTRACTED: "Contracted",
  LOST: "Lost",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  PENDING_START: "Pending Start",
  STARTED: "Started",
  COMPLETED: "Completed",
  DEFECT_LIABILITY_PERIOD: "Defect Liability Period",
  ARCHIVED: "Archived",
};

export const PHASE_COLORS: Record<JobPhase, string> = {
  OPPORTUNITY: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  QUOTING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  WON_AWAITING_CONTRACT: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  CONTRACTED: "bg-green-500/10 text-green-600 border-green-500/20",
  LOST: "bg-red-500/10 text-red-600 border-red-500/20",
};

export const STATUS_COLORS: Record<JobStatus, string> = {
  ACTIVE: "bg-green-500/10 text-green-600 border-green-500/20",
  ON_HOLD: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  PENDING_START: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  STARTED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  COMPLETED: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  DEFECT_LIABILITY_PERIOD: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ARCHIVED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export const PHASE_ORDER: Record<JobPhase, number> = {
  OPPORTUNITY: 0,
  QUOTING: 1,
  WON_AWAITING_CONTRACT: 2,
  CONTRACTED: 3,
  LOST: -1,
};

export const PHASE_TO_INT: Record<JobPhase, number> = {
  OPPORTUNITY: 0,
  QUOTING: 1,
  WON_AWAITING_CONTRACT: 2,
  CONTRACTED: 3,
  LOST: 4,
};

export const INT_TO_PHASE: Record<number, JobPhase> = {
  0: "OPPORTUNITY",
  1: "QUOTING",
  2: "WON_AWAITING_CONTRACT",
  3: "CONTRACTED",
  4: "LOST",
};

export function phaseToInt(phase: JobPhase): number {
  return PHASE_TO_INT[phase] ?? 0;
}

export function intToPhase(val: number): JobPhase {
  return INT_TO_PHASE[val] ?? "OPPORTUNITY";
}

export type JobCapability =
  | "DOCUMENTS_TASKS"
  | "PRODUCTION_SLOTS"
  | "DRAFTING_PROGRAM"
  | "START_DRAFTING"
  | "PRODUCE_PANELS"
  | "DELIVER_PANELS"
  | "CLAIMS";

export const PHASE_CAPABILITIES: Record<JobPhase, readonly JobCapability[]> = {
  OPPORTUNITY: ["DOCUMENTS_TASKS"],
  QUOTING: ["DOCUMENTS_TASKS"],
  WON_AWAITING_CONTRACT: [
    "DOCUMENTS_TASKS",
    "PRODUCTION_SLOTS",
    "DRAFTING_PROGRAM",
    "START_DRAFTING",
  ],
  CONTRACTED: [
    "DOCUMENTS_TASKS",
    "PRODUCTION_SLOTS",
    "DRAFTING_PROGRAM",
    "START_DRAFTING",
    "PRODUCE_PANELS",
    "DELIVER_PANELS",
    "CLAIMS",
  ],
  LOST: ["DOCUMENTS_TASKS"],
};

export function jobHasCapability(phase: JobPhase, capability: JobCapability): boolean {
  return PHASE_CAPABILITIES[phase]?.includes(capability) ?? false;
}

export function isValidStatusForPhase(phase: JobPhase, status: JobStatus): boolean {
  return PHASE_ALLOWED_STATUSES[phase]?.includes(status) ?? false;
}

export function getDefaultStatusForPhase(phase: JobPhase): JobStatus | null {
  const allowed = PHASE_ALLOWED_STATUSES[phase];
  if (!allowed || allowed.length === 0) return null;
  return allowed[0];
}

export function canAdvanceToPhase(currentPhase: JobPhase, targetPhase: JobPhase): boolean {
  if (targetPhase === "LOST") return true;
  if (currentPhase === "LOST") return false;
  const currentOrder = PHASE_ORDER[currentPhase];
  const targetOrder = PHASE_ORDER[targetPhase];
  return targetOrder === currentOrder + 1 || targetOrder === currentOrder - 1 || targetOrder === currentOrder;
}

export function getPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase as JobPhase] || phase.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status as JobStatus] || status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function isJobVisibleInDropdowns(phase: JobPhase): boolean {
  return phase !== "LOST";
}

export function mapOldStatusToPhaseAndStatus(oldStatus: string): { phase: JobPhase; status: JobStatus | null } {
  switch (oldStatus) {
    case "OPPORTUNITY":
      return { phase: "OPPORTUNITY", status: "ON_HOLD" };
    case "QUOTING":
      return { phase: "QUOTING", status: "ON_HOLD" };
    case "WON":
      return { phase: "WON_AWAITING_CONTRACT", status: "PENDING_START" };
    case "CONTRACTED":
      return { phase: "CONTRACTED", status: "STARTED" };
    case "IN_PROGRESS":
      return { phase: "CONTRACTED", status: "STARTED" };
    case "ACTIVE":
      return { phase: "CONTRACTED", status: "STARTED" };
    case "ON_HOLD":
      return { phase: "CONTRACTED", status: "ON_HOLD" };
    case "COMPLETED":
      return { phase: "CONTRACTED", status: "COMPLETED" };
    case "ARCHIVED":
      return { phase: "CONTRACTED", status: "COMPLETED" };
    case "LOST":
    case "CANCELLED":
      return { phase: "LOST", status: null };
    default:
      return { phase: "OPPORTUNITY", status: "ON_HOLD" };
  }
}
