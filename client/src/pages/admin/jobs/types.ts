import { z } from "zod";
import type { Job, PanelRegister } from "@shared/schema";
import { JOB_PHASES } from "@shared/job-phases";

export const AUSTRALIAN_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;

export const JOB_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#a855f7", // purple
];

export const jobSchema = z.object({
  jobNumber: z.string().min(1, "Job number is required"),
  name: z.string().min(1, "Name is required"),
  client: z.string().optional(),
  customerId: z.string().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.enum(AUSTRALIAN_STATES).optional().nullable(),
  description: z.string().optional(),
  craneCapacity: z.string().optional(),
  numberOfBuildings: z.number().int().min(0).optional().nullable(),
  levels: z.string().optional(),
  lowestLevel: z.string().optional(),
  highestLevel: z.string().optional(),
  productionStartDate: z.string().optional(),
  expectedCycleTimePerFloor: z.number().int().min(1).optional().nullable(),
  daysInAdvance: z.number().int().min(1).optional().nullable(),
  daysToAchieveIfc: z.number().int().min(1).optional().nullable(),
  productionWindowDays: z.number().int().min(1).optional().nullable(),
  productionDaysInAdvance: z.number().int().min(1).optional().nullable(),
  procurementDaysInAdvance: z.number().int().min(1).optional().nullable(),
  procurementTimeDays: z.number().int().min(1).optional().nullable(),
  siteContact: z.string().optional(),
  siteContactPhone: z.string().optional(),
  jobPhase: z.enum(JOB_PHASES as unknown as [string, ...string[]]).optional(),
  status: z.string(),
  projectManagerId: z.string().optional().nullable(),
  factoryId: z.string().optional().nullable(),
  productionSlotColor: z.string().optional().nullable(),
  jobTypeId: z.string().optional().nullable(),
});

export type JobFormData = z.infer<typeof jobSchema>;

export interface JobWithPanels extends Job {
  panels: PanelRegister[];
  panelCount?: number;
  completedPanelCount?: number;
}

export interface CostOverride {
  id: string;
  jobId: string;
  panelTypeId: string;
  componentName: string;
  defaultPercentage: string;
  revisedPercentage: string | null;
  notes: string | null;
}

export interface PanelTypeInfo {
  id: string;
  code: string;
  name: string;
}

export type SortField = "jobNumber" | "client" | "status";
export type SortDirection = "asc" | "desc";

export interface ProductionSlotStatus {
  hasSlots: boolean;
  hasNonStartedSlots: boolean;
  allStarted: boolean;
  totalSlots: number;
  nonStartedCount: number;
}

export interface LevelCycleTime {
  buildingNumber: number;
  level: string;
  levelOrder: number;
  cycleDays: number;
}
