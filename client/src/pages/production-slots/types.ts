import type { Job, ProductionSlot, ProductionSlotAdjustment, User, PanelRegister, Factory, CfmeuHoliday } from "@shared/schema";

export interface ProductionSlotWithDetails extends ProductionSlot {
  job: Job;
  levelCycleTime?: number | null;
}

export interface ProductionSlotAdjustmentWithDetails extends ProductionSlotAdjustment {
  changedBy: User;
}

export type StatusFilter = "ALL" | "SCHEDULED" | "PENDING_UPDATE" | "BOOKED" | "COMPLETED";
export type GroupBy = "none" | "job" | "client" | "week" | "factory";

export interface SlotFiltersProps {
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  jobFilter: string;
  setJobFilter: (v: string) => void;
  factoryFilter: string;
  setFactoryFilter: (v: string) => void;
  groupBy: GroupBy;
  setGroupBy: (v: GroupBy) => void;
  dateFromFilter: string;
  setDateFromFilter: (v: string) => void;
  dateToFilter: string;
  setDateToFilter: (v: string) => void;
  allJobs: Job[];
  factories: Factory[];
}

export interface SlotTableProps {
  slots: ProductionSlotWithDetails[];
  groupBy: GroupBy;
  groupedSlots: Record<string, { label: string; slots: ProductionSlotWithDetails[]; job?: Job }> | null;
  expandedGroups: Set<string>;
  toggleGroup: (groupKey: string) => void;
  isManagerOrAdmin: boolean;
  getDateColorClass: (slot: ProductionSlotWithDetails) => string;
  getSlotStatusBadge: (status: string) => React.ReactNode;
  openAdjustDialog: (slot: ProductionSlotWithDetails) => void;
  openPanelBreakdown: (slot: ProductionSlotWithDetails) => void;
  openHistory: (slot: ProductionSlotWithDetails) => void;
  bookSlotMutation: { mutate: (id: string) => void; isPending: boolean };
  completeSlotMutation: { mutate: (id: string) => void; isPending: boolean };
  getFactory: (factoryId: string | null | undefined) => Factory | undefined;
  getTimelineDates: () => { label: string; date: Date; days: number }[];
  getSlotForDateRange: (jobSlots: ProductionSlotWithDetails[], targetDate: Date) => ProductionSlotWithDetails | null;
  isWithinOnsiteWindow: (slot: ProductionSlotWithDetails) => boolean;
}

export interface ProductionSlotDialogsProps {
  showGenerateDialog: boolean;
  setShowGenerateDialog: (v: boolean) => void;
  showLevelMismatchDialog: boolean;
  setShowLevelMismatchDialog: (v: boolean) => void;
  showDraftingUpdateDialog: boolean;
  setShowDraftingUpdateDialog: (v: boolean) => void;
  showDraftingWarningDialog: boolean;
  setShowDraftingWarningDialog: (v: boolean) => void;
  showAdjustDialog: boolean;
  setShowAdjustDialog: (v: boolean) => void;
  showPanelBreakdownDialog: boolean;
  setShowPanelBreakdownDialog: (v: boolean) => void;
  showHistoryDialog: boolean;
  setShowHistoryDialog: (v: boolean) => void;
  selectedSlot: ProductionSlotWithDetails | null;
  jobsWithoutSlots: Job[];
  selectedJobsForGeneration: string[];
  setSelectedJobsForGeneration: (v: string[]) => void;
  generateSlotsMutation: { isPending: boolean };
  handleGenerateSlots: (skipEmptyLevels?: boolean) => void;
  levelMismatchInfo: {
    jobId: string;
    jobName: string;
    jobLevels: number;
    panelLevels: number;
    highestJobLevel: string;
    highestPanelLevel: string;
    emptyLevels: string[];
  } | null;
  setPendingJobsForGeneration: (v: string[]) => void;
  setLevelMismatchInfo: (v: null) => void;
  handleLevelMismatchConfirm: (skipEmpty: boolean) => void;
  handleDraftingUpdateConfirm: (update: boolean) => void;
  handleDraftingWarningConfirm: (update: boolean) => void;
  updateDraftingProgramMutation: { isPending: boolean };
  adjustNewDate: string;
  setAdjustNewDate: (v: string) => void;
  adjustReason: string;
  setAdjustReason: (v: string) => void;
  adjustClientConfirmed: boolean;
  setAdjustClientConfirmed: (v: boolean) => void;
  adjustCascade: boolean;
  setAdjustCascade: (v: boolean) => void;
  handleAdjustSubmit: () => void;
  adjustSlotMutation: { isPending: boolean };
  resetAdjustForm: () => void;
  panelsForSlot: PanelRegister[];
  panelEntries: Record<string, { productionDate: string; entryId: string }>;
  panelSearchQuery: string;
  setPanelSearchQuery: (v: string) => void;
  panelStatusFilter: string;
  setPanelStatusFilter: (v: string) => void;
  panelTypeFilter: string;
  setPanelTypeFilter: (v: string) => void;
  expandedPanelTypes: Set<string>;
  togglePanelTypeGroup: (type: string) => void;
  filteredPanels: PanelRegister[];
  panelsByType: Record<string, PanelRegister[]>;
  uniquePanelTypes: string[];
  uniquePanelStatuses: string[];
  isManagerOrAdmin: boolean;
  productionWindowDays: number;
  bookingPanelId: string | null;
  setBookingPanelId: (v: string | null) => void;
  bookingDate: string;
  setBookingDate: (v: string) => void;
  bookPanelMutation: { mutate: (data: { slotId: string; panelId: string; productionDate: string }) => void; isPending: boolean };
  unbookPanelMutation: { mutate: (entryId: string) => void; isPending: boolean };
  slotAdjustments: ProductionSlotAdjustmentWithDetails[];
}

export interface CalendarViewProps {
  slots: ProductionSlotWithDetails[];
  factories: Factory[];
  getFactory: (factoryId: string | null | undefined) => Factory | undefined;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  calendarViewMode: "week" | "month";
  setCalendarViewMode: (mode: "week" | "month") => void;
  weekStartDay: number;
  onSlotClick: (slot: ProductionSlotWithDetails) => void;
  selectedFactoryId: string | null;
}
