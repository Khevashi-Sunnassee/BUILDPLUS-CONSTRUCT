export const SALES_STAGES = [
  "OPPORTUNITY",
  "PRE_QUALIFICATION",
  "ESTIMATING",
  "SUBMITTED",
  "AWARDED",
  "LOST",
] as const;

export type SalesStage = (typeof SALES_STAGES)[number];

export const STAGE_STATUSES: Record<SalesStage, { value: string; label: string }[]> = {
  OPPORTUNITY: [
    { value: "NEW_OPPORTUNITY_LOGGED", label: "New Opportunity Logged" },
    { value: "CLIENT_CONTACTED", label: "Client Contacted" },
    { value: "AWAITING_DRAWINGS", label: "Awaiting Drawings" },
    { value: "AWAITING_SCOPE_INFO", label: "Awaiting Scope Info" },
    { value: "SITE_VISIT_REQUIRED", label: "Site Visit Required" },
    { value: "SITE_VISIT_COMPLETED", label: "Site Visit Completed" },
    { value: "NOT_SUITABLE", label: "Not Suitable (Scope Mismatch)" },
    { value: "DUPLICATE", label: "Duplicate / Already Quoted" },
  ],
  PRE_QUALIFICATION: [
    { value: "REVIEWING_CLIENT", label: "Reviewing Client" },
    { value: "REVIEWING_SCOPE_FIT", label: "Reviewing Scope Fit" },
    { value: "CAPACITY_CHECK", label: "Capacity Check" },
    { value: "PRICING_STRATEGY_REVIEW", label: "Pricing Strategy Review" },
    { value: "APPROVED_FOR_ESTIMATING", label: "Approved for Estimating" },
    { value: "DECLINED_CAPACITY", label: "Declined - Capacity" },
    { value: "DECLINED_RISK_PROFILE", label: "Declined - Risk Profile" },
    { value: "DECLINED_NOT_OUR_MARKET", label: "Declined - Not Our Market" },
  ],
  ESTIMATING: [
    { value: "DRAWINGS_RECEIVED", label: "Drawings Received" },
    { value: "REVIEWING_DRAWINGS", label: "Reviewing Drawings" },
    { value: "RFIS_ISSUED", label: "RFIs Issued" },
    { value: "AWAITING_RFI_RESPONSE", label: "Awaiting RFI Response" },
    { value: "ESTIMATING_IN_PROGRESS", label: "Estimating in Progress" },
    { value: "INTERNAL_REVIEW", label: "Internal Review" },
    { value: "TENDER_PRICING_APPROVED", label: "Tender Pricing Approved" },
    { value: "TENDER_BEING_PREPARED", label: "Tender Being Prepared" },
    { value: "READY_TO_SUBMIT", label: "Ready to Submit" },
  ],
  SUBMITTED: [
    { value: "TENDER_SUBMITTED", label: "Tender Submitted" },
    { value: "AWAITING_FEEDBACK", label: "Awaiting Feedback" },
    { value: "CLARIFICATION_REQUESTED", label: "Clarification Requested" },
    { value: "CLARIFICATION_PROVIDED", label: "Clarification Provided" },
    { value: "VALUE_ENGINEERING_REQUESTED", label: "Value Engineering Requested" },
    { value: "PRICING_REVISION_SUBMITTED", label: "Pricing Revision Submitted" },
    { value: "SHORTLISTED", label: "Shortlisted" },
  ],
  AWARDED: [
    { value: "LETTER_OF_INTENT_RECEIVED", label: "Letter of Intent Received" },
    { value: "CONTRACT_UNDER_REVIEW", label: "Contract Under Review" },
    { value: "CONTRACT_NEGOTIATIONS", label: "Contract Negotiations" },
    { value: "CONTRACT_EXECUTED", label: "Contract Executed" },
    { value: "HANDED_OVER_TO_DELIVERY", label: "Handed Over to Delivery" },
  ],
  LOST: [
    { value: "LOST_PRICE", label: "Lost - Price" },
    { value: "LOST_SCOPE", label: "Lost - Scope" },
    { value: "LOST_TIMING", label: "Lost - Timing" },
    { value: "LOST_CLIENT_DECISION", label: "Lost - Client Decision" },
    { value: "LOST_COMPETITOR", label: "Lost - Competitor" },
    { value: "LOST_NO_FEEDBACK", label: "Lost - No Feedback" },
  ],
};

export const STAGE_LABELS: Record<SalesStage, string> = {
  OPPORTUNITY: "Opportunity",
  PRE_QUALIFICATION: "Pre-Qualification",
  ESTIMATING: "Estimating / Tender",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  LOST: "Lost",
};

export const STAGE_COLORS: Record<SalesStage, string> = {
  OPPORTUNITY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PRE_QUALIFICATION: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  ESTIMATING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  SUBMITTED: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  AWARDED: "bg-green-500/10 text-green-500 border-green-500/20",
  LOST: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const OPPORTUNITY_TYPES = [
  { value: "BUILDER_SELECTED", label: "Builder Selected" },
  { value: "OPEN_TENDER", label: "Open Tender" },
  { value: "NEGOTIATED_CONTRACT", label: "Negotiated Contract" },
  { value: "GENERAL_PRICING", label: "General Pricing" },
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]["value"];

export function getDefaultStatus(stage: SalesStage): string {
  return STAGE_STATUSES[stage]?.[0]?.value ?? "";
}

export function isValidStatusForStage(stage: SalesStage, status: string): boolean {
  return STAGE_STATUSES[stage]?.some((s) => s.value === status) ?? false;
}

export function getStatusLabel(stage: SalesStage, statusValue: string): string {
  const found = STAGE_STATUSES[stage]?.find((s) => s.value === statusValue);
  return found?.label ?? statusValue.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
