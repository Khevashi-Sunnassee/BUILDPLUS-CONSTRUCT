import { eq, and, desc, sql, asc, gte, lte, inArray } from "drizzle-orm";
import { db } from "./db";
export { db };
import {
  users, devices, mappingRules, dailyLogs, logRows,
  approvalEvents, auditEvents, globalSettings, jobs, jobLevelCycleTimes, panelRegister, productionEntries,
  panelTypes, jobPanelRates, workTypes, panelTypeCostComponents, jobCostOverrides,
  trailerTypes, loadLists, loadListPanels, deliveryRecords, productionDays, weeklyWageReports,
  userPermissions, FUNCTION_KEYS, weeklyJobReports, weeklyJobReportSchedules, zones,
  productionSlots, productionSlotAdjustments, draftingProgram,
  suppliers, itemCategories, items, purchaseOrders, purchaseOrderItems, purchaseOrderAttachments,
  taskGroups, tasks, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  factories, cfmeuHolidays,
  type InsertUser, type User, type InsertDevice, type Device,
  type InsertMappingRule, type MappingRule,
  type InsertDailyLog, type DailyLog, type InsertLogRow, type LogRow,
  type InsertApprovalEvent, type ApprovalEvent, type GlobalSettings,
  type InsertJob, type Job, type InsertPanelRegister, type PanelRegister,
  type InsertProductionEntry, type ProductionEntry,
  type InsertProductionDay, type ProductionDay,
  type InsertPanelType, type PanelTypeConfig, type InsertJobPanelRate, type JobPanelRate,
  type InsertWorkType, type WorkType,
  type InsertPanelTypeCostComponent, type PanelTypeCostComponent,
  type InsertJobCostOverride, type JobCostOverride,
  type InsertTrailerType, type TrailerType,
  type InsertLoadList, type LoadList, type InsertLoadListPanel, type LoadListPanel,
  type InsertDeliveryRecord, type DeliveryRecord,
  type InsertWeeklyWageReport, type WeeklyWageReport,
  type InsertUserPermission, type UserPermission, type FunctionKey, type PermissionLevel,
  type InsertWeeklyJobReport, type WeeklyJobReport,
  type InsertWeeklyJobReportSchedule, type WeeklyJobReportSchedule,
  type InsertZone, type Zone,
  type InsertProductionSlot, type ProductionSlot,
  type InsertProductionSlotAdjustment, type ProductionSlotAdjustment,
  type InsertDraftingProgram, type DraftingProgram,
  type InsertSupplier, type Supplier,
  type InsertItemCategory, type ItemCategory,
  type InsertItem, type Item,
  type InsertPurchaseOrder, type PurchaseOrder,
  type InsertPurchaseOrderItem, type PurchaseOrderItem,
  type InsertPurchaseOrderAttachment, type PurchaseOrderAttachment,
  type InsertTaskGroup, type TaskGroup,
  type InsertTask, type Task, type TaskStatus,
  type InsertTaskAssignee, type TaskAssignee,
  type InsertTaskUpdate, type TaskUpdate,
  type InsertTaskFile, type TaskFile,
  type InsertTaskNotification, type TaskNotification,
  type InsertJobLevelCycleTime, type JobLevelCycleTime,
  type Factory, type CfmeuHoliday,
} from "@shared/schema";

// Working days calculation utilities
export interface WorkingDaysConfig {
  workDays: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  holidays: Date[]; // Array of dates that are holidays
}

/**
 * Get the effective work days for a factory.
 * If factory inherits, uses global productionWorkDays; otherwise uses factory's workDays.
 */
export async function getFactoryWorkDays(factoryId: string | null): Promise<boolean[]> {
  const defaultWorkDays = [false, true, true, true, true, true, false]; // Mon-Fri default
  
  if (!factoryId) {
    const settings = await db.select().from(globalSettings).limit(1);
    return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
  }
  
  const [factory] = await db.select().from(factories).where(eq(factories.id, factoryId));
  if (!factory) {
    const settings = await db.select().from(globalSettings).limit(1);
    return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
  }
  
  if (factory.inheritWorkDays) {
    const settings = await db.select().from(globalSettings).limit(1);
    return (settings[0]?.productionWorkDays as boolean[]) ?? defaultWorkDays;
  }
  
  return (factory.workDays as boolean[]) ?? defaultWorkDays;
}

/**
 * Get holidays for a CFMEU calendar type within a date range.
 */
export async function getCfmeuHolidaysInRange(
  calendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null,
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  if (!calendarType) return [];
  
  const holidays = await db.select()
    .from(cfmeuHolidays)
    .where(
      and(
        eq(cfmeuHolidays.calendarType, calendarType),
        gte(cfmeuHolidays.date, startDate),
        lte(cfmeuHolidays.date, endDate)
      )
    );
  
  return holidays.map(h => new Date(h.date));
}

/**
 * Check if a date is a working day based on work days config and holidays.
 * Uses local date comparison to avoid timezone issues (dates stored in Australia/Melbourne timezone).
 */
export function isWorkingDay(date: Date, workDays: boolean[], holidays: Date[]): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if this day of week is a work day
  if (!workDays[dayOfWeek]) return false;
  
  // Check if this date is a holiday using local date comparison (avoid UTC conversion issues)
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  const isHoliday = holidays.some(h => 
    h.getFullYear() === year && h.getMonth() === month && h.getDate() === day
  );
  
  return !isHoliday;
}

/**
 * Add working days to a date (positive = forward, negative = backward).
 * This accounts for work days of the week and CFMEU holidays.
 */
export function addWorkingDays(
  startDate: Date,
  workingDays: number,
  workDays: boolean[],
  holidays: Date[]
): Date {
  const result = new Date(startDate);
  const direction = workingDays >= 0 ? 1 : -1;
  let remaining = Math.abs(workingDays);
  
  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (isWorkingDay(result, workDays, holidays)) {
      remaining--;
    }
  }
  
  return result;
}

/**
 * Subtract working days from a date (convenience function).
 */
export function subtractWorkingDays(
  startDate: Date,
  workingDays: number,
  workDays: boolean[],
  holidays: Date[]
): Date {
  return addWorkingDays(startDate, -workingDays, workDays, holidays);
}

export interface WeeklyJobReportWithDetails extends WeeklyJobReport {
  projectManager: User;
  approvedBy?: User | null;
  schedules: (WeeklyJobReportSchedule & { job: Job })[];
}

export interface LoadListWithDetails extends LoadList {
  job: Job;
  trailerType?: TrailerType | null;
  panels: (LoadListPanel & { panel: PanelRegister })[];
  deliveryRecord?: DeliveryRecord | null;
  createdBy?: User | null;
}

export interface ProductionSlotWithDetails extends ProductionSlot {
  job: Job;
  levelCycleTime?: number | null;
}

export interface ProductionSlotAdjustmentWithDetails extends ProductionSlotAdjustment {
  changedBy: User;
}

export interface DraftingProgramWithDetails extends DraftingProgram {
  panel: PanelRegister;
  job: Job;
  productionSlot?: ProductionSlot | null;
  assignedTo?: User | null;
}

export interface PurchaseOrderWithDetails extends PurchaseOrder {
  requestedBy: User;
  approvedBy?: User | null;
  rejectedBy?: User | null;
  supplier?: Supplier | null;
  items: PurchaseOrderItem[];
  attachmentCount?: number;
}

export interface ItemWithDetails extends Item {
  category?: ItemCategory | null;
  supplier?: Supplier | null;
}

export interface TaskWithDetails extends Task {
  assignees: (TaskAssignee & { user: User })[];
  subtasks: Task[];
  updatesCount: number;
  filesCount: number;
  createdBy?: User | null;
  job?: Job | null;
}

export interface TaskGroupWithTasks extends TaskGroup {
  tasks: TaskWithDetails[];
}
import bcrypt from "bcrypt";
import crypto from "crypto";

export function sha256Hex(raw: string | Buffer) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function randomKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password?: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  validatePassword(user: User, password: string): Promise<boolean>;
  updateUserSettings(userId: string, settings: { selectedFactoryIds?: string[] | null }): Promise<void>;

  getDevice(id: string): Promise<(Device & { user: User }) | undefined>;
  getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined>;
  createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }>;
  updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;
  getAllDevices(): Promise<(Device & { user: User })[]>;

  createMappingRule(data: InsertMappingRule): Promise<MappingRule>;
  deleteMappingRule(id: string): Promise<void>;
  getMappingRules(): Promise<MappingRule[]>;

  getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined>;
  getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]>;
  getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]>;
  getDailyLogByUserAndDay(userId: string, logDay: string): Promise<DailyLog | undefined>;
  createDailyLog(data: { userId: string; logDay: string; status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" }): Promise<DailyLog>;
  upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog>;
  updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined>;

  getLogRow(id: string): Promise<LogRow | undefined>;
  upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow>;
  updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean; workTypeId: number | null }>): Promise<LogRow | undefined>;
  deleteLogRow(id: string): Promise<void>;
  deleteDailyLog(id: string): Promise<void>;
  deleteProductionDay(id: string): Promise<void>;
  deleteProductionDayByDateAndFactory(date: string, factory: string): Promise<void>;
  deleteProductionDayByDateAndFactoryId(date: string, factoryId: string): Promise<void>;

  createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent>;

  getGlobalSettings(): Promise<GlobalSettings | undefined>;
  updateGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings>;

  getDashboardStats(userId: string): Promise<any>;
  getReports(period: string): Promise<any>;

  getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined>;
  getJobByNumber(jobNumber: string): Promise<Job | undefined>;
  createJob(data: InsertJob): Promise<Job>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[] })[]>;
  importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }>;

  getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined>;
  getPanelsByJob(jobId: string): Promise<PanelRegister[]>;
  getPanelsByJobAndLevel(jobId: string, level: string): Promise<PanelRegister[]>;
  createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister>;
  updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined>;
  deletePanelRegisterItem(id: string): Promise<void>;
  getAllPanelRegisterItems(): Promise<(PanelRegister & { job: Job })[]>;
  getPaginatedPanelRegisterItems(options: { page: number; limit: number; jobId?: string; search?: string; status?: string; documentStatus?: string; factoryId?: string }): Promise<{ panels: (PanelRegister & { job: Job })[]; total: number; page: number; limit: number; totalPages: number }>;
  importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number }>;
  updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void>;
  getPanelCountsBySource(): Promise<{ source: number; count: number }[]>;
  panelsWithSourceHaveRecords(source: number): Promise<boolean>;
  deletePanelsBySource(source: number): Promise<number>;
  deletePanelsByJobAndSource(jobId: string, source: number): Promise<number>;
  getExistingPanelSourceIds(jobId: string): Promise<Set<string>>;
  importEstimatePanels(data: any[]): Promise<{ imported: number; errors: string[] }>;

  getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined>;
  getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesByDateAndFactory(date: string, factory: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesByDateAndFactoryId(date: string, factoryId: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry>;
  updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined>;
  deleteProductionEntry(id: string): Promise<void>;
  getProductionEntryByPanelId(panelId: string): Promise<ProductionEntry | undefined>;
  getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]>;
  
  getProductionDays(startDate: string, endDate: string): Promise<ProductionDay[]>;
  getProductionDay(date: string, factory: string): Promise<ProductionDay | undefined>;
  getProductionDayByFactoryId(date: string, factoryId: string): Promise<ProductionDay | undefined>;
  createProductionDay(data: InsertProductionDay): Promise<ProductionDay>;
  getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]>;
  getDailyLogsWithRowsInRange(startDate: string, endDate: string): Promise<Array<{
    log: DailyLog;
    user: User;
    rows: LogRow[];
  }>>;

  getPanelType(id: string): Promise<PanelTypeConfig | undefined>;
  getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined>;
  createPanelType(data: InsertPanelType): Promise<PanelTypeConfig>;
  updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined>;
  deletePanelType(id: string): Promise<void>;
  getAllPanelTypes(): Promise<PanelTypeConfig[]>;

  getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined>;
  getJobPanelRates(jobId: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig })[]>;
  upsertJobPanelRate(jobId: string, panelTypeId: string, data: Partial<InsertJobPanelRate>): Promise<JobPanelRate>;
  deleteJobPanelRate(id: string): Promise<void>;
  getEffectiveRates(jobId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; jobRate?: JobPanelRate })[]>;

  getWorkType(id: number): Promise<WorkType | undefined>;
  getWorkTypeByCode(code: string): Promise<WorkType | undefined>;
  createWorkType(data: InsertWorkType): Promise<WorkType>;
  updateWorkType(id: number, data: Partial<InsertWorkType>): Promise<WorkType | undefined>;
  deleteWorkType(id: number): Promise<void>;
  getAllWorkTypes(): Promise<WorkType[]>;
  getActiveWorkTypes(): Promise<WorkType[]>;

  getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]>;
  createCostComponent(data: InsertPanelTypeCostComponent): Promise<PanelTypeCostComponent>;
  updateCostComponent(id: string, data: Partial<InsertPanelTypeCostComponent>): Promise<PanelTypeCostComponent | undefined>;
  deleteCostComponent(id: string): Promise<void>;
  replaceCostComponents(panelTypeId: string, components: InsertPanelTypeCostComponent[]): Promise<PanelTypeCostComponent[]>;

  getJobCostOverrides(jobId: string): Promise<JobCostOverride[]>;
  getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]>;
  createJobCostOverride(data: InsertJobCostOverride): Promise<JobCostOverride>;
  updateJobCostOverride(id: string, data: Partial<InsertJobCostOverride>): Promise<JobCostOverride | undefined>;
  deleteJobCostOverride(id: string): Promise<void>;
  initializeJobCostOverrides(jobId: string): Promise<JobCostOverride[]>;

  // Panel production approval
  getPanelById(id: string): Promise<PanelRegister | undefined>;
  approvePanelForProduction(id: string, approvedById: string, data: {
    loadWidth?: string | null;
    loadHeight?: string | null;
    panelThickness?: string | null;
    panelVolume?: string | null;
    panelMass?: string | null;
    panelArea?: string | null;
    day28Fc?: string | null;
    liftFcm?: string | null;
    concreteStrengthMpa?: string | null;
    rotationalLifters?: string | null;
    primaryLifters?: string | null;
    productionPdfUrl?: string | null;
  }): Promise<PanelRegister | undefined>;
  revokePanelProductionApproval(id: string): Promise<PanelRegister | undefined>;
  getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]>;

  // Logistics - Trailer Types
  getAllTrailerTypes(): Promise<TrailerType[]>;
  getActiveTrailerTypes(): Promise<TrailerType[]>;
  getTrailerType(id: string): Promise<TrailerType | undefined>;
  createTrailerType(data: InsertTrailerType): Promise<TrailerType>;
  updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined>;
  deleteTrailerType(id: string): Promise<void>;

  // Logistics - Load Lists
  getAllLoadLists(): Promise<LoadListWithDetails[]>;
  getLoadList(id: string): Promise<LoadListWithDetails | undefined>;
  createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails>;
  updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined>;
  deleteLoadList(id: string): Promise<void>;
  addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel>;
  removePanelFromLoadList(loadListId: string, panelId: string): Promise<void>;
  getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]>;

  // Logistics - Delivery Records
  getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined>;
  createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord>;
  updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined>;

  // Weekly Wage Reports
  getWeeklyWageReports(startDate?: string, endDate?: string): Promise<WeeklyWageReport[]>;
  getWeeklyWageReport(id: string): Promise<WeeklyWageReport | undefined>;
  getWeeklyWageReportByWeek(weekStartDate: string, weekEndDate: string, factory: string): Promise<WeeklyWageReport | undefined>;
  getWeeklyWageReportByWeekAndFactoryId(weekStartDate: string, weekEndDate: string, factoryId: string): Promise<WeeklyWageReport | undefined>;
  createWeeklyWageReport(data: InsertWeeklyWageReport & { createdById: string }): Promise<WeeklyWageReport>;
  updateWeeklyWageReport(id: string, data: Partial<InsertWeeklyWageReport>): Promise<WeeklyWageReport | undefined>;
  deleteWeeklyWageReport(id: string): Promise<void>;

  // Weekly Job Reports
  getWeeklyJobReports(projectManagerId?: string): Promise<WeeklyJobReportWithDetails[]>;
  getWeeklyJobReport(id: string): Promise<WeeklyJobReportWithDetails | undefined>;
  getWeeklyJobReportsByStatus(status: string): Promise<WeeklyJobReportWithDetails[]>;
  createWeeklyJobReport(data: InsertWeeklyJobReport, schedules: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails>;
  updateWeeklyJobReport(id: string, data: Partial<InsertWeeklyJobReport>, schedules?: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails | undefined>;
  submitWeeklyJobReport(id: string): Promise<WeeklyJobReport | undefined>;
  approveWeeklyJobReport(id: string, approvedById: string): Promise<WeeklyJobReport | undefined>;
  rejectWeeklyJobReport(id: string, approvedById: string, rejectionReason: string): Promise<WeeklyJobReport | undefined>;
  deleteWeeklyJobReport(id: string): Promise<void>;
  getJobsForProjectManager(projectManagerId: string): Promise<Job[]>;
  getApprovedWeeklyJobReports(): Promise<WeeklyJobReportWithDetails[]>;

  // User Permissions
  getUserPermissions(userId: string): Promise<UserPermission[]>;
  getUserPermission(userId: string, functionKey: FunctionKey): Promise<UserPermission | undefined>;
  setUserPermission(userId: string, functionKey: FunctionKey, permissionLevel: PermissionLevel): Promise<UserPermission>;
  deleteUserPermission(userId: string, functionKey: FunctionKey): Promise<void>;
  initializeUserPermissions(userId: string): Promise<UserPermission[]>;
  getAllUserPermissionsForAdmin(): Promise<{ user: User; permissions: UserPermission[] }[]>;

  // Zones
  getAllZones(): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  getZoneByCode(code: string): Promise<Zone | undefined>;
  createZone(data: InsertZone): Promise<Zone>;
  updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined>;
  deleteZone(id: string): Promise<void>;

  // Production Slots
  getProductionSlots(filters?: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<ProductionSlotWithDetails[]>;
  getProductionSlot(id: string): Promise<ProductionSlotWithDetails | undefined>;
  checkPanelLevelCoverage(jobId: string): Promise<{ jobLevels: number; panelLevels: number; highestJobLevel: string; highestPanelLevel: string; hasMismatch: boolean; emptyLevels: string[] }>;
  generateProductionSlotsForJob(jobId: string, skipEmptyLevels?: boolean): Promise<ProductionSlot[]>;
  adjustProductionSlot(id: string, data: { newDate: Date; reason: string; changedById: string; clientConfirmed?: boolean; cascadeToLater?: boolean }): Promise<ProductionSlot | undefined>;
  bookProductionSlot(id: string): Promise<ProductionSlot | undefined>;
  completeProductionSlot(id: string): Promise<ProductionSlot | undefined>;
  getProductionSlotAdjustments(slotId: string): Promise<ProductionSlotAdjustmentWithDetails[]>;
  getJobsWithoutProductionSlots(): Promise<Job[]>;
  deleteProductionSlot(id: string): Promise<void>;
  checkAndCompleteSlotByPanelCompletion(jobId: string, level: string, buildingNumber: number): Promise<void>;

  // Drafting Program
  getDraftingPrograms(filters?: { jobId?: string; status?: string; assignedToId?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<DraftingProgramWithDetails[]>;
  getDraftingProgram(id: string): Promise<DraftingProgramWithDetails | undefined>;
  getDraftingProgramByPanelId(panelId: string): Promise<DraftingProgram | undefined>;
  createDraftingProgram(data: InsertDraftingProgram): Promise<DraftingProgram>;
  updateDraftingProgram(id: string, data: Partial<InsertDraftingProgram>): Promise<DraftingProgram | undefined>;
  deleteDraftingProgram(id: string): Promise<void>;
  deleteDraftingProgramByJob(jobId: string): Promise<number>;
  generateDraftingProgramFromProductionSlots(): Promise<{ created: number; updated: number }>;
  assignDraftingResource(id: string, assignedToId: string, proposedStartDate: Date): Promise<DraftingProgram | undefined>;

  // Suppliers
  getAllSuppliers(): Promise<Supplier[]>;
  getActiveSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<void>;

  // Item Categories
  getAllItemCategories(): Promise<ItemCategory[]>;
  getActiveItemCategories(): Promise<ItemCategory[]>;
  getItemCategory(id: string): Promise<ItemCategory | undefined>;
  createItemCategory(data: InsertItemCategory): Promise<ItemCategory>;
  updateItemCategory(id: string, data: Partial<InsertItemCategory>): Promise<ItemCategory | undefined>;
  deleteItemCategory(id: string): Promise<void>;

  // Items
  getAllItems(): Promise<ItemWithDetails[]>;
  getActiveItems(): Promise<ItemWithDetails[]>;
  getItem(id: string): Promise<ItemWithDetails | undefined>;
  getItemsByCategory(categoryId: string): Promise<ItemWithDetails[]>;
  getItemsBySupplier(supplierId: string): Promise<ItemWithDetails[]>;
  createItem(data: InsertItem): Promise<Item>;
  updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<void>;
  bulkImportItems(itemsData: InsertItem[]): Promise<{ created: number; updated: number; errors: string[] }>;

  // Purchase Orders
  getAllPurchaseOrders(): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrdersByUser(userId: string): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrderWithDetails | undefined>;
  createPurchaseOrder(data: InsertPurchaseOrder, lineItems: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails>;
  updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>, lineItems?: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails | undefined>;
  submitPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder | undefined>;
  rejectPurchaseOrder(id: string, rejectedById: string, reason: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<void>;
  getNextPONumber(): Promise<string>;

  // PO Attachments
  getPurchaseOrderAttachments(poId: string): Promise<(PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[]>;
  getPurchaseOrderAttachment(id: string): Promise<PurchaseOrderAttachment | undefined>;
  createPurchaseOrderAttachment(data: InsertPurchaseOrderAttachment): Promise<PurchaseOrderAttachment>;
  deletePurchaseOrderAttachment(id: string): Promise<void>;

  // Task Management (Monday.com-style)
  getAllTaskGroups(): Promise<TaskGroupWithTasks[]>;
  getTaskGroup(id: string): Promise<TaskGroupWithTasks | undefined>;
  createTaskGroup(data: InsertTaskGroup): Promise<TaskGroup>;
  updateTaskGroup(id: string, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined>;
  deleteTaskGroup(id: string): Promise<void>;
  reorderTaskGroups(groupIds: string[]): Promise<void>;

  getTask(id: string): Promise<TaskWithDetails | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(groupId: string, taskIds: string[]): Promise<void>;

  getTaskAssignees(taskId: string): Promise<(TaskAssignee & { user: User })[]>;
  setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]>;

  getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User })[]>;
  createTaskUpdate(data: InsertTaskUpdate): Promise<TaskUpdate>;
  deleteTaskUpdate(id: string): Promise<void>;

  getTaskFiles(taskId: string): Promise<(TaskFile & { uploadedBy?: User | null })[]>;
  createTaskFile(data: InsertTaskFile): Promise<TaskFile>;
  deleteTaskFile(id: string): Promise<void>;

  // Task Notifications
  getTaskNotifications(userId: string): Promise<any[]>;
  getUnreadTaskNotificationCount(userId: string): Promise<number>;
  markTaskNotificationRead(id: string): Promise<void>;
  markAllTaskNotificationsRead(userId: string): Promise<void>;
  createTaskNotificationsForAssignees(taskId: string, excludeUserId: string, type: string, title: string, body: string | null, updateId: string | null): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async createUser(data: InsertUser & { password?: string }): Promise<User> {
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const [user] = await db.insert(users).values({
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash,
      role: data.role || "USER",
      isActive: data.isActive ?? true,
    }).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined> {
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    if (data.email) {
      updateData.email = data.email.toLowerCase();
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateUserSettings(userId: string, settings: { selectedFactoryIds?: string[] | null }): Promise<void> {
    await db.update(users)
      .set({
        selectedFactoryIds: settings.selectedFactoryIds,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getDevice(id: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).where(eq(devices.id, id));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id))
      .where(and(eq(devices.apiKeyHash, apiKeyHash), eq(devices.isActive, true)));
    if (!result[0]) return undefined;
    return { ...result[0].devices, user: result[0].users };
  }

  async createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }> {
    const deviceKey = randomKey();
    const apiKeyHash = sha256Hex(deviceKey);
    const [device] = await db.insert(devices).values({
      userId: data.userId,
      deviceName: data.deviceName,
      os: data.os || "Windows",
      apiKeyHash,
      isActive: true,
    }).returning();
    return { device, deviceKey };
  }

  async updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined> {
    const [device] = await db.update(devices).set({ ...data, updatedAt: new Date() }).where(eq(devices.id, id)).returning();
    return device;
  }

  async deleteDevice(id: string): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }

  async getAllDevices(): Promise<(Device & { user: User })[]> {
    const result = await db.select().from(devices).innerJoin(users, eq(devices.userId, users.id)).orderBy(desc(devices.createdAt));
    return result.map(r => ({ ...r.devices, user: r.users }));
  }

  async createMappingRule(data: InsertMappingRule): Promise<MappingRule> {
    const [rule] = await db.insert(mappingRules).values(data).returning();
    return rule;
  }

  async deleteMappingRule(id: string): Promise<void> {
    await db.delete(mappingRules).where(eq(mappingRules.id, id));
  }

  async getMappingRules(): Promise<MappingRule[]> {
    return db.select().from(mappingRules).orderBy(asc(mappingRules.priority));
  }

  async getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined> {
    const [log] = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id)).where(eq(dailyLogs.id, id));
    if (!log) return undefined;

    const rows = await db.select().from(logRows).leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .where(eq(logRows.dailyLogId, id)).orderBy(asc(logRows.startAt));

    return {
      ...log.daily_logs,
      user: log.users,
      rows: rows.map(r => ({ ...r.log_rows, job: r.jobs || undefined })),
    };
  }

  async getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]> {
    const conditions = [eq(dailyLogs.userId, userId)];
    
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(dailyLogs.status, filters.status as any));
    }
    
    if (filters?.dateRange && filters.dateRange !== "all") {
      const today = new Date();
      let startDate: Date;
      
      if (filters.dateRange === "today") {
        startDate = today;
      } else if (filters.dateRange === "week") {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
      } else if (filters.dateRange === "month") {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 1);
      } else {
        startDate = new Date(0);
      }
      
      if (startDate.getTime() > 0) {
        const startDateStr = startDate.toISOString().split("T")[0];
        conditions.push(gte(dailyLogs.logDay, startDateStr));
      }
    }
    
    return db.select().from(dailyLogs).where(and(...conditions)).orderBy(desc(dailyLogs.logDay));
  }

  async getSubmittedDailyLogs(): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]> {
    const logs = await db.select().from(dailyLogs).innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(eq(dailyLogs.status, "SUBMITTED")).orderBy(desc(dailyLogs.logDay));

    const result = [];
    for (const log of logs) {
      const rows = await db.select().from(logRows).leftJoin(jobs, eq(logRows.jobId, jobs.id))
        .where(eq(logRows.dailyLogId, log.daily_logs.id)).orderBy(asc(logRows.startAt));
      result.push({
        ...log.daily_logs,
        user: log.users,
        rows: rows.map(r => ({ ...r.log_rows, job: r.jobs || undefined })),
      });
    }
    return result;
  }

  async getDailyLogByUserAndDay(userId: string, logDay: string): Promise<DailyLog | undefined> {
    const [log] = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDay, logDay), eq(dailyLogs.discipline, "DRAFTING")));
    return log;
  }

  async createDailyLog(data: { userId: string; logDay: string; status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" }): Promise<DailyLog> {
    const [log] = await db.insert(dailyLogs).values({
      userId: data.userId,
      logDay: data.logDay,
      tz: "Australia/Melbourne",
      discipline: "DRAFTING",
      status: data.status,
    }).returning();
    return log;
  }

  async upsertDailyLog(data: { userId: string; logDay: string; tz: string }): Promise<DailyLog> {
    const existing = await db.select().from(dailyLogs)
      .where(and(eq(dailyLogs.userId, data.userId), eq(dailyLogs.logDay, data.logDay), eq(dailyLogs.discipline, "DRAFTING")));
    if (existing[0]) return existing[0];

    const [log] = await db.insert(dailyLogs).values({
      userId: data.userId,
      logDay: data.logDay,
      tz: data.tz,
      discipline: "DRAFTING",
      status: "PENDING",
    }).returning();
    return log;
  }

  async updateDailyLogStatus(id: string, data: { status: string; submittedAt?: Date; approvedAt?: Date; approvedBy?: string; managerComment?: string }): Promise<DailyLog | undefined> {
    const [log] = await db.update(dailyLogs).set({ ...data, updatedAt: new Date() } as any).where(eq(dailyLogs.id, id)).returning();
    return log;
  }

  async getLogRow(id: string): Promise<LogRow | undefined> {
    const [row] = await db.select().from(logRows).where(eq(logRows.id, id));
    return row;
  }

  async upsertLogRow(sourceEventId: string, data: Partial<InsertLogRow> & { dailyLogId: string }): Promise<LogRow> {
    const existing = await db.select().from(logRows).where(eq(logRows.sourceEventId, sourceEventId));
    if (existing[0]) {
      const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.sourceEventId, sourceEventId)).returning();
      return row;
    }

    const [row] = await db.insert(logRows).values({
      ...data,
      sourceEventId,
    } as any).returning();
    return row;
  }

  async updateLogRow(id: string, data: Partial<{ panelMark: string; drawingCode: string; notes: string; jobId: string; isUserEdited: boolean; workTypeId: number | null }>): Promise<LogRow | undefined> {
    const [row] = await db.update(logRows).set({ ...data, updatedAt: new Date() }).where(eq(logRows.id, id)).returning();
    return row;
  }

  async deleteLogRow(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.id, id));
  }

  async deleteDailyLog(id: string): Promise<void> {
    await db.delete(logRows).where(eq(logRows.dailyLogId, id));
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  }

  async deleteProductionDay(id: string): Promise<void> {
    await db.delete(productionDays).where(eq(productionDays.id, id));
  }

  async deleteProductionDayByDateAndFactory(date: string, factory: string): Promise<void> {
    // First delete all production entries for this date and factory
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factory, factory)
      )
    );
    // Then delete the production day
    await db.delete(productionDays).where(
      and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factory, factory)
      )
    );
  }

  async deleteProductionDayByDateAndFactoryId(date: string, factoryId: string): Promise<void> {
    // First delete all production entries for this date and factory
    await db.delete(productionEntries).where(
      and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factoryId, factoryId)
      )
    );
    // Then delete the production day
    await db.delete(productionDays).where(
      and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factoryId, factoryId)
      )
    );
  }

  async createApprovalEvent(data: InsertApprovalEvent): Promise<ApprovalEvent> {
    const [event] = await db.insert(approvalEvents).values(data).returning();
    return event;
  }

  async getGlobalSettings(): Promise<GlobalSettings | undefined> {
    const [settings] = await db.select().from(globalSettings);
    return settings;
  }

  async updateGlobalSettings(data: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const existing = await this.getGlobalSettings();
    if (existing) {
      const [settings] = await db.update(globalSettings).set({ ...data, updatedAt: new Date() }).where(eq(globalSettings.id, existing.id)).returning();
      return settings;
    }
    const [settings] = await db.insert(globalSettings).values(data as any).returning();
    return settings;
  }

  async getDashboardStats(userId: string): Promise<any> {
    const today = new Date().toISOString().split("T")[0];

    const todayLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDay, today)));
    let todayMinutes = 0;
    let todayIdleMinutes = 0;
    if (todayLogs[0]) {
      const rows = await db.select().from(logRows).where(eq(logRows.dailyLogId, todayLogs[0].id));
      todayMinutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
      todayIdleMinutes = rows.reduce((sum, r) => sum + r.idleMin, 0);
    }

    const pendingLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "PENDING")));
    const submittedLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "SUBMITTED")));
    const approvedLogs = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.status, "APPROVED")));

    const recentLogs = await db.select().from(dailyLogs).where(eq(dailyLogs.userId, userId)).orderBy(desc(dailyLogs.logDay)).limit(5);
    const recentLogsWithTotal = [];
    for (const log of recentLogs) {
      const rows = await db.select().from(logRows).where(eq(logRows.dailyLogId, log.id));
      const totalMinutes = rows.reduce((sum, r) => sum + r.durationMin, 0);
      recentLogsWithTotal.push({
        id: log.id,
        logDay: log.logDay,
        status: log.status,
        totalMinutes,
        app: rows[0]?.app || "revit",
      });
    }

    return {
      todayMinutes,
      todayIdleMinutes,
      pendingDays: pendingLogs.length,
      submittedAwaitingApproval: submittedLogs.length,
      approvedThisWeek: approvedLogs.length,
      recentLogs: recentLogsWithTotal,
    };
  }

  async getReports(period: string): Promise<any> {
    const today = new Date();
    let startDate: Date;
    
    if (period === "week") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
    } else if (period === "quarter") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
    } else if (period === "year") {
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
    } else {
      startDate = new Date(0);
    }
    
    const startDateStr = startDate.toISOString().split("T")[0];
    
    const allRows = await db.select().from(logRows)
      .innerJoin(dailyLogs, eq(logRows.dailyLogId, dailyLogs.id))
      .leftJoin(jobs, eq(logRows.jobId, jobs.id))
      .leftJoin(users, eq(dailyLogs.userId, users.id))
      .where(gte(dailyLogs.logDay, startDateStr));

    const userMap = new Map<string, { name: string; email: string; totalMinutes: number; days: Set<string> }>();
    const jobMap = new Map<string, { name: string; code: string; totalMinutes: number }>();
    const appMap = new Map<string, number>();
    const sheetMap = new Map<string, { sheetNumber: string; sheetName: string; totalMinutes: number; projectName: string }>();
    const dailyMap = new Map<string, { date: string; totalMinutes: number; users: Set<string> }>();
    const userDailyMap = new Map<string, Map<string, number>>(); // userId -> date -> minutes
    let totalMinutes = 0;

    for (const row of allRows) {
      totalMinutes += row.log_rows.durationMin;
      const logDay = row.daily_logs.logDay;

      // By user
      const userId = row.daily_logs.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, { name: row.users?.name || "", email: row.users?.email || "", totalMinutes: 0, days: new Set() });
      }
      const user = userMap.get(userId)!;
      user.totalMinutes += row.log_rows.durationMin;
      user.days.add(logDay);

      // By job
      if (row.jobs) {
        const jobId = row.jobs.id;
        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, { name: row.jobs.name, code: row.jobs.code || row.jobs.jobNumber || "", totalMinutes: 0 });
        }
        jobMap.get(jobId)!.totalMinutes += row.log_rows.durationMin;
      }

      // By app
      const app = row.log_rows.app;
      appMap.set(app, (appMap.get(app) || 0) + row.log_rows.durationMin);

      // By sheet (Revit sheets)
      const sheetNumber = row.log_rows.revitSheetNumber;
      if (sheetNumber) {
        const sheetKey = `${sheetNumber}-${row.jobs?.name || "Unknown"}`;
        if (!sheetMap.has(sheetKey)) {
          sheetMap.set(sheetKey, { 
            sheetNumber, 
            sheetName: row.log_rows.revitSheetName || "", 
            totalMinutes: 0,
            projectName: row.jobs?.name || "Unknown"
          });
        }
        sheetMap.get(sheetKey)!.totalMinutes += row.log_rows.durationMin;
      }

      // Daily breakdown
      if (!dailyMap.has(logDay)) {
        dailyMap.set(logDay, { date: logDay, totalMinutes: 0, users: new Set() });
      }
      const dayData = dailyMap.get(logDay)!;
      dayData.totalMinutes += row.log_rows.durationMin;
      dayData.users.add(userId);

      // User daily breakdown (for per-resource charts)
      if (!userDailyMap.has(userId)) {
        userDailyMap.set(userId, new Map());
      }
      const userDays = userDailyMap.get(userId)!;
      userDays.set(logDay, (userDays.get(logDay) || 0) + row.log_rows.durationMin);
    }

    // Build daily trend data
    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: d.date, totalMinutes: d.totalMinutes, userCount: d.users.size }));

    // Build user daily breakdown for resource chart
    const resourceDaily = Array.from(userMap.entries()).map(([userId, userData]) => {
      const userDays = userDailyMap.get(userId) || new Map();
      const dailyData = Array.from(userDays.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, minutes]) => ({ date, minutes }));
      return {
        userId,
        name: userData.name,
        email: userData.email,
        totalMinutes: userData.totalMinutes,
        activeDays: userData.days.size,
        dailyBreakdown: dailyData,
      };
    });

    return {
      summary: {
        totalMinutes,
        totalUsers: userMap.size,
        totalProjects: jobMap.size,
        totalSheets: sheetMap.size,
        avgMinutesPerDay: userMap.size > 0 ? Math.round(totalMinutes / Array.from(userMap.values()).reduce((sum, u) => sum + u.days.size, 0)) : 0,
      },
      byUser: Array.from(userMap.values()).map(u => ({ name: u.name, email: u.email, totalMinutes: u.totalMinutes, activeDays: u.days.size })),
      byProject: Array.from(jobMap.values()),
      byApp: Array.from(appMap.entries()).map(([app, totalMinutes]) => ({ app, totalMinutes })),
      bySheet: Array.from(sheetMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
      dailyTrend,
      resourceDaily,
    };
  }

  async getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    if (!job) return undefined;
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, id)).orderBy(asc(panelRegister.panelMark));
    return { ...job, panels };
  }

  async getJobByNumber(jobNumber: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobNumber, jobNumber));
    return job;
  }

  async createJob(data: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(data).returning();
    return job;
  }

  async updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db.update(jobs).set({ ...data, updatedAt: new Date() }).where(eq(jobs.id, id)).returning();
    return job;
  }

  async deleteJob(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.jobId, id));
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[]; panelCount: number; completedPanelCount: number })[]> {
    const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    const allRules = await db.select().from(mappingRules);
    
    const panelCounts = await db.select({
      jobId: panelRegister.jobId,
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${panelRegister.status} = 'COMPLETED')`
    }).from(panelRegister).groupBy(panelRegister.jobId);
    
    const countsByJob = new Map<string, { total: number; completed: number }>();
    for (const row of panelCounts) {
      countsByJob.set(row.jobId, { total: Number(row.total), completed: Number(row.completed) });
    }
    
    const rulesByJob = new Map<string, MappingRule[]>();
    for (const rule of allRules) {
      if (!rulesByJob.has(rule.jobId)) {
        rulesByJob.set(rule.jobId, []);
      }
      rulesByJob.get(rule.jobId)!.push(rule);
    }
    
    return allJobs.map(job => {
      const counts = countsByJob.get(job.id) || { total: 0, completed: 0 };
      return {
        ...job,
        panels: [],
        mappingRules: rulesByJob.get(job.id) || [],
        panelCount: counts.total,
        completedPanelCount: counts.completed,
      };
    });
  }

  async importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const jobData of data) {
      try {
        const existing = await this.getJobByNumber(jobData.jobNumber);
        if (existing) {
          skipped++;
          continue;
        }
        await this.createJob(jobData);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  async getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.id, id));
    if (result.length === 0) return undefined;
    return { ...result[0].panel_register, job: result[0].jobs };
  }

  async getPanelsByJob(jobId: string): Promise<PanelRegister[]> {
    return db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId)).orderBy(asc(panelRegister.panelMark));
  }

  async getPanelsByJobAndLevel(jobId: string, level: string): Promise<PanelRegister[]> {
    return db.select().from(panelRegister)
      .where(and(eq(panelRegister.jobId, jobId), eq(panelRegister.level, level)))
      .orderBy(asc(panelRegister.panelMark));
  }

  async createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister> {
    const [panel] = await db.insert(panelRegister).values(data).returning();
    return panel;
  }

  async updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined> {
    const [panel] = await db.update(panelRegister).set({ ...data, updatedAt: new Date() }).where(eq(panelRegister.id, id)).returning();
    return panel;
  }

  async deletePanelRegisterItem(id: string): Promise<void> {
    await db.delete(panelRegister).where(eq(panelRegister.id, id));
  }

  async getAllPanelRegisterItems(): Promise<(PanelRegister & { job: Job })[]> {
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.panel_register, job: r.jobs }));
  }

  async getPaginatedPanelRegisterItems(options: { page: number; limit: number; jobId?: string; search?: string; status?: string; documentStatus?: string; factoryId?: string }): Promise<{ panels: (PanelRegister & { job: Job })[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page, limit, jobId, search, status, documentStatus, factoryId } = options;
    const offset = (page - 1) * limit;
    
    // Build conditions array
    const conditions = [];
    if (jobId) {
      conditions.push(eq(panelRegister.jobId, jobId));
    }
    if (factoryId) {
      conditions.push(eq(jobs.factoryId, factoryId));
    }
    if (status) {
      conditions.push(eq(panelRegister.status, status as typeof panelRegister.status.enumValues[number]));
    }
    if (documentStatus) {
      conditions.push(eq(panelRegister.documentStatus, documentStatus as typeof panelRegister.documentStatus.enumValues[number]));
    }
    if (search) {
      conditions.push(sql`(
        ${panelRegister.panelMark} ILIKE ${'%' + search + '%'} OR 
        ${panelRegister.description} ILIKE ${'%' + search + '%'} OR
        ${jobs.jobNumber} ILIKE ${'%' + search + '%'}
      )`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(whereClause);
    const total = countResult[0]?.count || 0;
    
    // Get paginated data
    const result = await db.select().from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(whereClause)
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark))
      .limit(limit)
      .offset(offset);
    
    const panels = result.map(r => ({ ...r.panel_register, job: r.jobs }));
    const totalPages = Math.ceil(total / limit);
    
    return { panels, total, page, limit, totalPages };
  }

  async importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;
    
    for (const panelData of data) {
      try {
        const existing = await db.select().from(panelRegister)
          .where(and(
            eq(panelRegister.jobId, panelData.jobId),
            eq(panelRegister.panelMark, panelData.panelMark)
          ));
        if (existing.length > 0) {
          skipped++;
          continue;
        }
        await this.createPanelRegisterItem(panelData);
        imported++;
      } catch (error) {
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  async updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, panelId));
    if (panel) {
      const newActualHours = (panel.actualHours || 0) + Math.round(additionalMinutes / 60);
      await db.update(panelRegister).set({ 
        actualHours: newActualHours, 
        updatedAt: new Date(),
        status: newActualHours > 0 ? "IN_PROGRESS" : panel.status,
      }).where(eq(panelRegister.id, panelId));
    }
  }

  async getPanelCountsBySource(): Promise<{ source: number; count: number }[]> {
    const result = await db.select({
      source: panelRegister.source,
      count: sql<number>`count(*)::int`
    })
    .from(panelRegister)
    .groupBy(panelRegister.source);
    return result;
  }

  async panelsWithSourceHaveRecords(source: number): Promise<boolean> {
    // Check if any panels from this source are approved for production or have production entries
    const panelsFromSource = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(eq(panelRegister.source, source));
    
    if (panelsFromSource.length === 0) return false;
    
    const panelIds = panelsFromSource.map(p => p.id);
    
    // Check for approved panels
    const approvedPanels = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.source, source),
        eq(panelRegister.approvedForProduction, true)
      ))
      .limit(1);
    
    if (approvedPanels.length > 0) return true;
    
    // Check for production entries
    const productionRecords = await db.select({ id: productionEntries.id })
      .from(productionEntries)
      .where(sql`${productionEntries.panelId} = ANY(${panelIds})`)
      .limit(1);
    
    return productionRecords.length > 0;
  }

  async deletePanelsBySource(source: number): Promise<number> {
    const result = await db.delete(panelRegister)
      .where(eq(panelRegister.source, source))
      .returning({ id: panelRegister.id });
    return result.length;
  }

  async deletePanelsByJobAndSource(jobId: string, source: number): Promise<number> {
    // Only delete panels that don't have production records and are not approved
    const panels = await db.select({ id: panelRegister.id })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.jobId, jobId),
        eq(panelRegister.source, source),
        eq(panelRegister.approvedForProduction, false)
      ));
    
    if (panels.length === 0) return 0;
    
    const panelIds = panels.map(p => p.id);
    
    // Check which panels have production records
    const panelsWithRecords = await db.select({ panelId: productionEntries.panelId })
      .from(productionEntries)
      .where(inArray(productionEntries.panelId, panelIds));
    
    const panelIdsWithRecords = new Set(panelsWithRecords.map(p => p.panelId));
    const deletableIds = panelIds.filter(id => !panelIdsWithRecords.has(id));
    
    if (deletableIds.length === 0) return 0;
    
    const result = await db.delete(panelRegister)
      .where(inArray(panelRegister.id, deletableIds))
      .returning({ id: panelRegister.id });
    return result.length;
  }

  async getExistingPanelSourceIds(jobId: string): Promise<Set<string>> {
    const panels = await db.select({ panelSourceId: panelRegister.panelSourceId })
      .from(panelRegister)
      .where(and(
        eq(panelRegister.jobId, jobId),
        sql`${panelRegister.panelSourceId} IS NOT NULL`
      ));
    return new Set(panels.map(p => p.panelSourceId).filter(Boolean) as string[]);
  }

  async importEstimatePanels(data: any[]): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    
    for (const panel of data) {
      try {
        // Check if panelMark already exists for this job (unless it has a unique panelSourceId)
        const existing = await db.select().from(panelRegister)
          .where(and(
            eq(panelRegister.jobId, panel.jobId),
            eq(panelRegister.panelMark, panel.panelMark)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing panel with new data if it's from the same source
          if (existing[0].panelSourceId === panel.panelSourceId) {
            await db.update(panelRegister)
              .set({
                ...panel,
                updatedAt: new Date(),
              })
              .where(eq(panelRegister.id, existing[0].id));
            imported++;
          } else {
            // Panel mark already exists from different source - create with modified mark
            const newMark = `${panel.panelMark}_${panel.sourceRow}`;
            await db.insert(panelRegister).values({
              ...panel,
              panelMark: newMark,
            });
            imported++;
          }
        } else {
          await db.insert(panelRegister).values(panel);
          imported++;
        }
      } catch (err: any) {
        errors.push(`Row ${panel.sourceRow}: ${err.message}`);
      }
    }
    
    return { imported, errors };
  }

  async getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .where(eq(productionEntries.id, id));
    if (!result.length) return undefined;
    return { ...result[0].production_entries, panel: result[0].panel_register, job: result[0].jobs };
  }

  async getProductionEntriesByDate(date: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(eq(productionEntries.productionDate, date))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getProductionEntriesInRange(startDate: string, endDate: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        gte(productionEntries.productionDate, startDate),
        lte(productionEntries.productionDate, endDate)
      ))
      .orderBy(asc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
    return await db.select().from(dailyLogs)
      .where(and(
        gte(dailyLogs.logDay, startDate),
        lte(dailyLogs.logDay, endDate)
      ))
      .orderBy(asc(dailyLogs.logDay));
  }

  async getDailyLogsWithRowsInRange(startDate: string, endDate: string): Promise<Array<{
    log: DailyLog;
    user: User;
    rows: LogRow[];
  }>> {
    const logs = await db.select().from(dailyLogs)
      .innerJoin(users, eq(dailyLogs.userId, users.id))
      .where(and(
        gte(dailyLogs.logDay, startDate),
        lte(dailyLogs.logDay, endDate)
      ))
      .orderBy(asc(dailyLogs.logDay));
    
    if (logs.length === 0) return [];
    
    const logIds = logs.map(l => l.daily_logs.id);
    const allRows = await db.select().from(logRows)
      .where(inArray(logRows.dailyLogId, logIds))
      .orderBy(asc(logRows.startAt));
    
    const rowsByLogId = new Map<string, LogRow[]>();
    for (const row of allRows) {
      if (!rowsByLogId.has(row.dailyLogId)) {
        rowsByLogId.set(row.dailyLogId, []);
      }
      rowsByLogId.get(row.dailyLogId)!.push(row);
    }
    
    return logs.map(l => ({
      log: l.daily_logs,
      user: l.users,
      rows: rowsByLogId.get(l.daily_logs.id) || [],
    }));
  }

  async createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry> {
    const [entry] = await db.insert(productionEntries).values(data).returning();
    return entry;
  }

  async updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined> {
    const [entry] = await db.update(productionEntries).set({ ...data, updatedAt: new Date() }).where(eq(productionEntries.id, id)).returning();
    return entry;
  }

  async deleteProductionEntry(id: string): Promise<void> {
    await db.delete(productionEntries).where(eq(productionEntries.id, id));
  }

  async getProductionEntryByPanelId(panelId: string): Promise<ProductionEntry | undefined> {
    const [entry] = await db.select().from(productionEntries)
      .where(eq(productionEntries.panelId, panelId))
      .limit(1);
    return entry;
  }

  async getAllProductionEntries(): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .orderBy(desc(productionEntries.productionDate), asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getProductionSummaryByDate(date: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]> {
    const entries = await this.getProductionEntriesByDate(date);
    const summary: Record<string, { count: number; totalVolumeM3: number; totalAreaM2: number }> = {};
    
    for (const entry of entries) {
      const panelType = entry.panel.panelType || "OTHER";
      if (!summary[panelType]) {
        summary[panelType] = { count: 0, totalVolumeM3: 0, totalAreaM2: 0 };
      }
      summary[panelType].count++;
      summary[panelType].totalVolumeM3 += parseFloat(entry.volumeM3 || "0");
      summary[panelType].totalAreaM2 += parseFloat(entry.areaM2 || "0");
    }
    
    return Object.entries(summary).map(([panelType, data]) => ({ panelType, ...data }));
  }

  async getProductionEntriesByDateAndFactory(date: string, factory: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factory, factory)
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getProductionEntriesByDateAndFactoryId(date: string, factoryId: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]> {
    const result = await db.select().from(productionEntries)
      .innerJoin(panelRegister, eq(productionEntries.panelId, panelRegister.id))
      .innerJoin(jobs, eq(productionEntries.jobId, jobs.id))
      .innerJoin(users, eq(productionEntries.userId, users.id))
      .where(and(
        eq(productionEntries.productionDate, date),
        eq(productionEntries.factoryId, factoryId)
      ))
      .orderBy(asc(jobs.jobNumber), asc(panelRegister.panelMark));
    return result.map(r => ({ ...r.production_entries, panel: r.panel_register, job: r.jobs, user: r.users }));
  }

  async getProductionDays(startDate: string, endDate: string): Promise<ProductionDay[]> {
    return await db.select().from(productionDays)
      .where(and(
        gte(productionDays.productionDate, startDate),
        lte(productionDays.productionDate, endDate)
      ))
      .orderBy(desc(productionDays.productionDate), asc(productionDays.factory));
  }

  async getProductionDay(date: string, factory: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factory, factory)
      ));
    return day;
  }

  async getProductionDayByFactoryId(date: string, factoryId: string): Promise<ProductionDay | undefined> {
    const [day] = await db.select().from(productionDays)
      .where(and(
        eq(productionDays.productionDate, date),
        eq(productionDays.factoryId, factoryId)
      ));
    return day;
  }

  async createProductionDay(data: InsertProductionDay): Promise<ProductionDay> {
    const [day] = await db.insert(productionDays).values(data).returning();
    return day;
  }

  async getPanelType(id: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.id, id));
    return pt;
  }

  async getPanelTypeByCode(code: string): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.select().from(panelTypes).where(eq(panelTypes.code, code));
    return pt;
  }

  async createPanelType(data: InsertPanelType): Promise<PanelTypeConfig> {
    const [pt] = await db.insert(panelTypes).values(data).returning();
    return pt;
  }

  async updatePanelType(id: string, data: Partial<InsertPanelType>): Promise<PanelTypeConfig | undefined> {
    const [pt] = await db.update(panelTypes).set({ ...data, updatedAt: new Date() }).where(eq(panelTypes.id, id)).returning();
    return pt;
  }

  async deletePanelType(id: string): Promise<void> {
    await db.delete(panelTypes).where(eq(panelTypes.id, id));
  }

  async getAllPanelTypes(): Promise<PanelTypeConfig[]> {
    return await db.select().from(panelTypes).orderBy(asc(panelTypes.name));
  }

  async getJobPanelRate(id: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig }) | undefined> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.id, id));
    if (!result.length) return undefined;
    return { ...result[0].job_panel_rates, panelType: result[0].panel_types };
  }

  async getJobPanelRates(jobId: string): Promise<(JobPanelRate & { panelType: PanelTypeConfig })[]> {
    const result = await db.select().from(jobPanelRates)
      .innerJoin(panelTypes, eq(jobPanelRates.panelTypeId, panelTypes.id))
      .where(eq(jobPanelRates.jobId, jobId));
    return result.map(r => ({ ...r.job_panel_rates, panelType: r.panel_types }));
  }

  async upsertJobPanelRate(jobId: string, panelTypeId: string, data: Partial<InsertJobPanelRate>): Promise<JobPanelRate> {
    const existing = await db.select().from(jobPanelRates)
      .where(and(eq(jobPanelRates.jobId, jobId), eq(jobPanelRates.panelTypeId, panelTypeId)));
    
    if (existing.length > 0) {
      const [updated] = await db.update(jobPanelRates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(jobPanelRates.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(jobPanelRates)
        .values({ jobId, panelTypeId, ...data })
        .returning();
      return created;
    }
  }

  async deleteJobPanelRate(id: string): Promise<void> {
    await db.delete(jobPanelRates).where(eq(jobPanelRates.id, id));
  }

  async getEffectiveRates(jobId: string): Promise<(PanelTypeConfig & { isOverridden: boolean; jobRate?: JobPanelRate })[]> {
    const allTypes = await this.getAllPanelTypes();
    const jobRates = await this.getJobPanelRates(jobId);
    const ratesMap = new Map(jobRates.map(r => [r.panelTypeId, r]));
    
    return allTypes.map(pt => ({
      ...pt,
      isOverridden: ratesMap.has(pt.id),
      jobRate: ratesMap.get(pt.id),
    }));
  }

  async getWorkType(id: number): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.id, id));
    return workType;
  }

  async getWorkTypeByCode(code: string): Promise<WorkType | undefined> {
    const [workType] = await db.select().from(workTypes).where(eq(workTypes.code, code));
    return workType;
  }

  async createWorkType(data: InsertWorkType): Promise<WorkType> {
    const [workType] = await db.insert(workTypes).values(data as any).returning();
    return workType;
  }

  async updateWorkType(id: number, data: Partial<InsertWorkType>): Promise<WorkType | undefined> {
    const [workType] = await db.update(workTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workTypes.id, id))
      .returning();
    return workType;
  }

  async deleteWorkType(id: number): Promise<void> {
    await db.delete(workTypes).where(eq(workTypes.id, id));
  }

  async getAllWorkTypes(): Promise<WorkType[]> {
    return db.select().from(workTypes).orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  }

  async getActiveWorkTypes(): Promise<WorkType[]> {
    return db.select().from(workTypes)
      .where(eq(workTypes.isActive, true))
      .orderBy(asc(workTypes.sortOrder), asc(workTypes.name));
  }

  async getCostComponentsByPanelType(panelTypeId: string): Promise<PanelTypeCostComponent[]> {
    return db.select().from(panelTypeCostComponents)
      .where(eq(panelTypeCostComponents.panelTypeId, panelTypeId))
      .orderBy(asc(panelTypeCostComponents.sortOrder));
  }

  async createCostComponent(data: InsertPanelTypeCostComponent): Promise<PanelTypeCostComponent> {
    const [component] = await db.insert(panelTypeCostComponents).values(data).returning();
    return component;
  }

  async updateCostComponent(id: string, data: Partial<InsertPanelTypeCostComponent>): Promise<PanelTypeCostComponent | undefined> {
    const [component] = await db.update(panelTypeCostComponents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(panelTypeCostComponents.id, id))
      .returning();
    return component;
  }

  async deleteCostComponent(id: string): Promise<void> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.id, id));
  }

  async replaceCostComponents(panelTypeId: string, components: InsertPanelTypeCostComponent[]): Promise<PanelTypeCostComponent[]> {
    await db.delete(panelTypeCostComponents).where(eq(panelTypeCostComponents.panelTypeId, panelTypeId));
    if (components.length === 0) return [];
    const inserted = await db.insert(panelTypeCostComponents).values(components).returning();
    return inserted;
  }

  async getJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(eq(jobCostOverrides.jobId, jobId))
      .orderBy(asc(jobCostOverrides.panelTypeId), asc(jobCostOverrides.componentName));
  }

  async getJobCostOverridesByPanelType(jobId: string, panelTypeId: string): Promise<JobCostOverride[]> {
    return db.select().from(jobCostOverrides)
      .where(and(
        eq(jobCostOverrides.jobId, jobId),
        eq(jobCostOverrides.panelTypeId, panelTypeId)
      ))
      .orderBy(asc(jobCostOverrides.componentName));
  }

  async createJobCostOverride(data: InsertJobCostOverride): Promise<JobCostOverride> {
    const [override] = await db.insert(jobCostOverrides).values(data).returning();
    return override;
  }

  async updateJobCostOverride(id: string, data: Partial<InsertJobCostOverride>): Promise<JobCostOverride | undefined> {
    const [override] = await db.update(jobCostOverrides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobCostOverrides.id, id))
      .returning();
    return override;
  }

  async deleteJobCostOverride(id: string): Promise<void> {
    await db.delete(jobCostOverrides).where(eq(jobCostOverrides.id, id));
  }

  async initializeJobCostOverrides(jobId: string): Promise<JobCostOverride[]> {
    const allPanelTypes = await this.getAllPanelTypes();
    const existingOverrides = await this.getJobCostOverrides(jobId);
    const existingKeys = new Set(existingOverrides.map(o => `${o.panelTypeId}:${o.componentName}`));
    
    const newOverrides: InsertJobCostOverride[] = [];
    for (const pt of allPanelTypes) {
      const components = await this.getCostComponentsByPanelType(pt.id);
      for (const comp of components) {
        const key = `${pt.id}:${comp.name}`;
        if (!existingKeys.has(key)) {
          newOverrides.push({
            jobId,
            panelTypeId: pt.id,
            componentName: comp.name,
            defaultPercentage: comp.percentageOfRevenue,
            revisedPercentage: null,
            notes: null,
          });
        }
      }
    }
    
    if (newOverrides.length > 0) {
      await db.insert(jobCostOverrides).values(newOverrides);
    }
    
    return this.getJobCostOverrides(jobId);
  }

  // Panel production approval methods
  async getPanelById(id: string): Promise<PanelRegister | undefined> {
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, id));
    return panel;
  }

  async approvePanelForProduction(id: string, approvedById: string, data: {
    loadWidth?: string | null;
    loadHeight?: string | null;
    panelThickness?: string | null;
    panelVolume?: string | null;
    panelMass?: string | null;
    panelArea?: string | null;
    day28Fc?: string | null;
    liftFcm?: string | null;
    concreteStrengthMpa?: string | null;
    rotationalLifters?: string | null;
    primaryLifters?: string | null;
    productionPdfUrl?: string | null;
  }): Promise<PanelRegister | undefined> {
    const [updated] = await db.update(panelRegister)
      .set({
        ...data,
        approvedForProduction: true,
        approvedAt: new Date(),
        approvedById,
        updatedAt: new Date(),
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return updated;
  }

  async revokePanelProductionApproval(id: string): Promise<PanelRegister | undefined> {
    const [updated] = await db.update(panelRegister)
      .set({
        approvedForProduction: false,
        approvedAt: null,
        approvedById: null,
        updatedAt: new Date(),
      })
      .where(eq(panelRegister.id, id))
      .returning();
    return updated;
  }

  async getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]> {
    let query = db.select()
      .from(panelRegister)
      .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
      .where(eq(panelRegister.approvedForProduction, true));
    
    if (jobId) {
      query = db.select()
        .from(panelRegister)
        .innerJoin(jobs, eq(panelRegister.jobId, jobs.id))
        .where(and(
          eq(panelRegister.approvedForProduction, true),
          eq(panelRegister.jobId, jobId)
        ));
    }
    
    const results = await query;
    return results.map(r => ({ ...r.panel_register, job: r.jobs }));
  }

  // Logistics - Trailer Types
  async getAllTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes).orderBy(asc(trailerTypes.sortOrder));
  }

  async getActiveTrailerTypes(): Promise<TrailerType[]> {
    return db.select().from(trailerTypes)
      .where(eq(trailerTypes.isActive, true))
      .orderBy(asc(trailerTypes.sortOrder));
  }

  async getTrailerType(id: string): Promise<TrailerType | undefined> {
    const [trailerType] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, id));
    return trailerType;
  }

  async createTrailerType(data: InsertTrailerType): Promise<TrailerType> {
    const [trailerType] = await db.insert(trailerTypes).values(data).returning();
    return trailerType;
  }

  async updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined> {
    const [updated] = await db.update(trailerTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(trailerTypes.id, id))
      .returning();
    return updated;
  }

  async deleteTrailerType(id: string): Promise<void> {
    await db.delete(trailerTypes).where(eq(trailerTypes.id, id));
  }

  // Logistics - Load Lists
  async getAllLoadLists(): Promise<LoadListWithDetails[]> {
    const allLoadLists = await db.select().from(loadLists).orderBy(desc(loadLists.createdAt));
    
    const results: LoadListWithDetails[] = [];
    for (const loadList of allLoadLists) {
      const details = await this.getLoadList(loadList.id);
      if (details) results.push(details);
    }
    return results;
  }

  async getLoadList(id: string): Promise<LoadListWithDetails | undefined> {
    const [loadList] = await db.select().from(loadLists).where(eq(loadLists.id, id));
    if (!loadList) return undefined;

    const [job] = await db.select().from(jobs).where(eq(jobs.id, loadList.jobId));
    if (!job) return undefined;

    let trailerType: TrailerType | null = null;
    if (loadList.trailerTypeId) {
      const [tt] = await db.select().from(trailerTypes).where(eq(trailerTypes.id, loadList.trailerTypeId));
      trailerType = tt || null;
    }

    const panelResults = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, id))
      .orderBy(asc(loadListPanels.sequence));

    const panels = panelResults.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));

    const [deliveryRecord] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, id));

    let createdBy: User | null = null;
    if (loadList.createdById) {
      const [user] = await db.select().from(users).where(eq(users.id, loadList.createdById));
      createdBy = user || null;
    }

    return {
      ...loadList,
      job,
      trailerType,
      panels,
      deliveryRecord: deliveryRecord || null,
      createdBy,
    };
  }

  async createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails> {
    const [loadList] = await db.insert(loadLists).values(data).returning();

    // Add panels to the load list
    if (panelIds.length > 0) {
      const panelData = panelIds.map((panelId, index) => ({
        loadListId: loadList.id,
        panelId,
        sequence: index + 1,
      }));
      await db.insert(loadListPanels).values(panelData);
    }

    const details = await this.getLoadList(loadList.id);
    return details!;
  }

  async updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined> {
    const [updated] = await db.update(loadLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loadLists.id, id))
      .returning();
    return updated;
  }

  async deleteLoadList(id: string): Promise<void> {
    await db.delete(loadLists).where(eq(loadLists.id, id));
  }

  async addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel> {
    // Get the max sequence if not provided
    if (!sequence) {
      const existingPanels = await db.select()
        .from(loadListPanels)
        .where(eq(loadListPanels.loadListId, loadListId));
      sequence = existingPanels.length + 1;
    }

    const [panel] = await db.insert(loadListPanels).values({
      loadListId,
      panelId,
      sequence,
    }).returning();
    return panel;
  }

  async removePanelFromLoadList(loadListId: string, panelId: string): Promise<void> {
    await db.delete(loadListPanels)
      .where(and(
        eq(loadListPanels.loadListId, loadListId),
        eq(loadListPanels.panelId, panelId)
      ));
  }

  async getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]> {
    const results = await db.select()
      .from(loadListPanels)
      .innerJoin(panelRegister, eq(loadListPanels.panelId, panelRegister.id))
      .where(eq(loadListPanels.loadListId, loadListId))
      .orderBy(asc(loadListPanels.sequence));

    return results.map(r => ({ ...r.load_list_panels, panel: r.panel_register }));
  }

  // Logistics - Delivery Records
  async getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined> {
    const [record] = await db.select().from(deliveryRecords).where(eq(deliveryRecords.loadListId, loadListId));
    return record;
  }

  async createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord> {
    const [record] = await db.insert(deliveryRecords).values(data).returning();
    
    // Update load list status to COMPLETE
    await db.update(loadLists)
      .set({ status: "COMPLETE", updatedAt: new Date() })
      .where(eq(loadLists.id, data.loadListId));
    
    return record;
  }

  async updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined> {
    const [updated] = await db.update(deliveryRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliveryRecords.id, id))
      .returning();
    return updated;
  }

  // Weekly Wage Reports
  async getWeeklyWageReports(startDate?: string, endDate?: string): Promise<WeeklyWageReport[]> {
    let query = db.select().from(weeklyWageReports);
    if (startDate && endDate) {
      query = query.where(and(
        gte(weeklyWageReports.weekStartDate, startDate),
        lte(weeklyWageReports.weekEndDate, endDate)
      )) as typeof query;
    }
    return await query.orderBy(desc(weeklyWageReports.weekStartDate), asc(weeklyWageReports.factory));
  }

  async getWeeklyWageReport(id: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports).where(eq(weeklyWageReports.id, id));
    return report;
  }

  async getWeeklyWageReportByWeek(weekStartDate: string, weekEndDate: string, factory: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factory, factory)
      ));
    return report;
  }

  async getWeeklyWageReportByWeekAndFactoryId(weekStartDate: string, weekEndDate: string, factoryId: string): Promise<WeeklyWageReport | undefined> {
    const [report] = await db.select().from(weeklyWageReports)
      .where(and(
        eq(weeklyWageReports.weekStartDate, weekStartDate),
        eq(weeklyWageReports.weekEndDate, weekEndDate),
        eq(weeklyWageReports.factoryId, factoryId)
      ));
    return report;
  }

  async createWeeklyWageReport(data: InsertWeeklyWageReport & { createdById: string }): Promise<WeeklyWageReport> {
    const [report] = await db.insert(weeklyWageReports).values(data).returning();
    return report;
  }

  async updateWeeklyWageReport(id: string, data: Partial<InsertWeeklyWageReport>): Promise<WeeklyWageReport | undefined> {
    const [updated] = await db.update(weeklyWageReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(weeklyWageReports.id, id))
      .returning();
    return updated;
  }

  async deleteWeeklyWageReport(id: string): Promise<void> {
    await db.delete(weeklyWageReports).where(eq(weeklyWageReports.id, id));
  }

  // Weekly Job Reports
  private async enrichWeeklyJobReport(report: WeeklyJobReport): Promise<WeeklyJobReportWithDetails> {
    const [projectManager] = await db.select().from(users).where(eq(users.id, report.projectManagerId));
    let approvedBy = null;
    if (report.approvedById) {
      const [approver] = await db.select().from(users).where(eq(users.id, report.approvedById));
      approvedBy = approver || null;
    }
    const schedules = await db.select()
      .from(weeklyJobReportSchedules)
      .where(eq(weeklyJobReportSchedules.reportId, report.id))
      .orderBy(asc(weeklyJobReportSchedules.priority));
    
    const schedulesWithJobs = await Promise.all(schedules.map(async (schedule) => {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, schedule.jobId));
      return { ...schedule, job };
    }));

    return { ...report, projectManager, approvedBy, schedules: schedulesWithJobs };
  }

  async getWeeklyJobReports(projectManagerId?: string): Promise<WeeklyJobReportWithDetails[]> {
    let query = db.select().from(weeklyJobReports);
    if (projectManagerId) {
      query = query.where(eq(weeklyJobReports.projectManagerId, projectManagerId)) as typeof query;
    }
    const reports = await query.orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => this.enrichWeeklyJobReport(r)));
  }

  async getWeeklyJobReport(id: string): Promise<WeeklyJobReportWithDetails | undefined> {
    const [report] = await db.select().from(weeklyJobReports).where(eq(weeklyJobReports.id, id));
    if (!report) return undefined;
    return this.enrichWeeklyJobReport(report);
  }

  async getWeeklyJobReportsByStatus(status: string): Promise<WeeklyJobReportWithDetails[]> {
    const reports = await db.select().from(weeklyJobReports)
      .where(eq(weeklyJobReports.status, status as any))
      .orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => this.enrichWeeklyJobReport(r)));
  }

  async createWeeklyJobReport(data: InsertWeeklyJobReport, schedules: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails> {
    const [report] = await db.insert(weeklyJobReports).values(data).returning();
    
    if (schedules.length > 0) {
      await db.insert(weeklyJobReportSchedules).values(
        schedules.map(s => ({ ...s, reportId: report.id }))
      );
    }
    
    return this.enrichWeeklyJobReport(report);
  }

  async updateWeeklyJobReport(id: string, data: Partial<InsertWeeklyJobReport>, schedules?: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    
    if (!updated) return undefined;

    if (schedules) {
      await db.delete(weeklyJobReportSchedules).where(eq(weeklyJobReportSchedules.reportId, id));
      if (schedules.length > 0) {
        await db.insert(weeklyJobReportSchedules).values(
          schedules.map(s => ({ ...s, reportId: id }))
        );
      }
    }
    
    return this.enrichWeeklyJobReport(updated);
  }

  async submitWeeklyJobReport(id: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "SUBMITTED", submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  }

  async approveWeeklyJobReport(id: string, approvedById: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "APPROVED", approvedById, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  }

  async rejectWeeklyJobReport(id: string, approvedById: string, rejectionReason: string): Promise<WeeklyJobReport | undefined> {
    const [updated] = await db.update(weeklyJobReports)
      .set({ status: "REJECTED", approvedById, rejectionReason, updatedAt: new Date() })
      .where(eq(weeklyJobReports.id, id))
      .returning();
    return updated;
  }

  async deleteWeeklyJobReport(id: string): Promise<void> {
    await db.delete(weeklyJobReportSchedules).where(eq(weeklyJobReportSchedules.reportId, id));
    await db.delete(weeklyJobReports).where(eq(weeklyJobReports.id, id));
  }

  async getJobsForProjectManager(projectManagerId: string): Promise<Job[]> {
    return db.select().from(jobs)
      .where(and(
        eq(jobs.projectManagerId, projectManagerId),
        eq(jobs.status, "ACTIVE")
      ))
      .orderBy(asc(jobs.jobNumber));
  }

  async getApprovedWeeklyJobReports(): Promise<WeeklyJobReportWithDetails[]> {
    const reports = await db.select().from(weeklyJobReports)
      .where(eq(weeklyJobReports.status, "APPROVED"))
      .orderBy(desc(weeklyJobReports.reportDate));
    return Promise.all(reports.map(r => this.enrichWeeklyJobReport(r)));
  }

  // User Permissions
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return await db.select().from(userPermissions).where(eq(userPermissions.userId, userId));
  }

  async getUserPermission(userId: string, functionKey: FunctionKey): Promise<UserPermission | undefined> {
    const [permission] = await db.select().from(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.functionKey, functionKey)
      ));
    return permission;
  }

  async setUserPermission(userId: string, functionKey: FunctionKey, permissionLevel: PermissionLevel): Promise<UserPermission> {
    const existing = await this.getUserPermission(userId, functionKey);
    if (existing) {
      const [updated] = await db.update(userPermissions)
        .set({ permissionLevel, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userPermissions).values({
        userId,
        functionKey,
        permissionLevel,
      }).returning();
      return created;
    }
  }

  async deleteUserPermission(userId: string, functionKey: FunctionKey): Promise<void> {
    await db.delete(userPermissions)
      .where(and(
        eq(userPermissions.userId, userId),
        eq(userPermissions.functionKey, functionKey)
      ));
  }

  async initializeUserPermissions(userId: string): Promise<UserPermission[]> {
    const existingPerms = await this.getUserPermissions(userId);
    const existingKeys = new Set(existingPerms.map(p => p.functionKey));
    const missingKeys = FUNCTION_KEYS.filter(key => !existingKeys.has(key));
    
    if (missingKeys.length === 0) return existingPerms;

    const newPerms = await db.insert(userPermissions)
      .values(missingKeys.map(functionKey => ({
        userId,
        functionKey,
        permissionLevel: "VIEW_AND_UPDATE" as PermissionLevel,
      })))
      .returning();
    
    return [...existingPerms, ...newPerms];
  }

  async getAllUserPermissionsForAdmin(): Promise<{ user: User; permissions: UserPermission[] }[]> {
    const allUsers = await db.select().from(users).where(eq(users.isActive, true));
    const allPerms = await db.select().from(userPermissions);
    
    const permsByUser = new Map<string, UserPermission[]>();
    for (const perm of allPerms) {
      const existing = permsByUser.get(perm.userId) || [];
      existing.push(perm);
      permsByUser.set(perm.userId, existing);
    }
    
    return allUsers.map(user => ({
      user,
      permissions: permsByUser.get(user.id) || [],
    }));
  }

  async getAllZones(): Promise<Zone[]> {
    return db.select().from(zones).orderBy(asc(zones.name));
  }

  async getZone(id: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.id, id));
    return zone;
  }

  async getZoneByCode(code: string): Promise<Zone | undefined> {
    const [zone] = await db.select().from(zones).where(eq(zones.code, code));
    return zone;
  }

  async createZone(data: InsertZone): Promise<Zone> {
    const [zone] = await db.insert(zones).values(data).returning();
    return zone;
  }

  async updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined> {
    const [zone] = await db.update(zones).set({ ...data, updatedAt: new Date() }).where(eq(zones.id, id)).returning();
    return zone;
  }

  async deleteZone(id: string): Promise<void> {
    await db.delete(zones).where(eq(zones.id, id));
  }

  // Production Slots
  async getProductionSlots(filters?: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<ProductionSlotWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.jobId) conditions.push(eq(productionSlots.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(productionSlots.status, filters.status as any));
    if (filters?.dateFrom) conditions.push(gte(productionSlots.productionSlotDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(productionSlots.productionSlotDate, filters.dateTo));
    
    // Join with jobs to filter by factory
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      conditions.push(inArray(jobs.factoryId, filters.factoryIds));
    }
    
    // Use join to filter by factory
    const query = db.select({
      productionSlot: productionSlots,
      job: jobs
    })
      .from(productionSlots)
      .innerJoin(jobs, eq(productionSlots.jobId, jobs.id))
      .orderBy(asc(productionSlots.productionSlotDate), asc(productionSlots.levelOrder));
    
    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    
    // Fetch level cycle times for all jobs in the results
    const jobIds = Array.from(new Set(results.map(r => r.job.id)));
    const levelCycleTimes = jobIds.length > 0 
      ? await db.select().from(jobLevelCycleTimes).where(inArray(jobLevelCycleTimes.jobId, jobIds))
      : [];
    
    // Create a lookup map for level cycle times
    const cycleTimeMap = new Map<string, number>();
    for (const ct of levelCycleTimes) {
      cycleTimeMap.set(`${ct.jobId}-${ct.level}`, ct.cycleDays);
    }
    
    return results.map(r => {
      const levelCycleTime = cycleTimeMap.get(`${r.job.id}-${r.productionSlot.level}`);
      return { 
        ...r.productionSlot, 
        job: r.job,
        levelCycleTime: levelCycleTime ?? null
      };
    });
  }

  async getProductionSlot(id: string): Promise<ProductionSlotWithDetails | undefined> {
    const [slot] = await db.select().from(productionSlots).where(eq(productionSlots.id, id));
    if (!slot) return undefined;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, slot.jobId));
    if (!job) return undefined;
    return { ...slot, job };
  }

  async checkPanelLevelCoverage(jobId: string): Promise<{ jobLevels: number; panelLevels: number; highestJobLevel: string; highestPanelLevel: string; hasMismatch: boolean; emptyLevels: string[] }> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error("Job not found");
    
    // Determine job levels
    let jobLevelList: string[] = [];
    if (job.lowestLevel && job.highestLevel) {
      jobLevelList = this.generateLevelRange(job.lowestLevel, job.highestLevel);
    } else if (job.levels) {
      jobLevelList = job.levels.split(",").map(l => l.trim()).filter(l => l);
    }
    
    // Get panels and their levels
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId));
    const panelLevelSet = new Set<string>();
    for (const panel of panels) {
      if (panel.level) {
        panelLevelSet.add(panel.level);
      }
    }
    const panelLevels = Array.from(panelLevelSet);
    
    // Sort job levels
    const sortedJobLevels = this.sortLevelsIntelligently(jobLevelList, job.lowestLevel, job.highestLevel);
    const sortedPanelLevels = this.sortLevelsIntelligently(panelLevels);
    
    // Find empty levels (job levels with no panels)
    const emptyLevels = sortedJobLevels.filter(level => !panelLevelSet.has(level));
    
    // Determine highest levels
    const highestJobLevel = sortedJobLevels.length > 0 ? sortedJobLevels[sortedJobLevels.length - 1] : "";
    const highestPanelLevel = sortedPanelLevels.length > 0 ? sortedPanelLevels[sortedPanelLevels.length - 1] : "";
    
    // Check if there's a mismatch (panels don't cover all job levels)
    const hasMismatch = emptyLevels.length > 0 && sortedPanelLevels.length > 0;
    
    return {
      jobLevels: sortedJobLevels.length,
      panelLevels: sortedPanelLevels.length,
      highestJobLevel,
      highestPanelLevel,
      hasMismatch,
      emptyLevels
    };
  }

  async generateProductionSlotsForJob(jobId: string, skipEmptyLevels: boolean = false): Promise<ProductionSlot[]> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw new Error("Job not found");
    if (!job.productionStartDate || !job.expectedCycleTimePerFloor) {
      throw new Error("Job missing required fields: productionStartDate or expectedCycleTimePerFloor");
    }
    
    // Determine levels - either generate from lowestLevel/highestLevel or parse from levels field
    let levelList: string[] = [];
    
    if (job.lowestLevel && job.highestLevel) {
      // Generate levels from lowestLevel to highestLevel
      levelList = this.generateLevelRange(job.lowestLevel, job.highestLevel);
    } else if (job.levels) {
      // Fall back to comma-separated levels field
      levelList = job.levels.split(",").map(l => l.trim()).filter(l => l);
    }
    
    if (levelList.length === 0) {
      throw new Error("Job must have either lowestLevel/highestLevel or levels defined");
    }

    // Delete existing slots for this job
    await db.delete(productionSlots).where(eq(productionSlots.jobId, jobId));

    // Sort levels intelligently
    const sortedLevels = this.sortLevelsIntelligently(levelList, job.lowestLevel, job.highestLevel);

    // Get panel counts per level
    const panels = await db.select().from(panelRegister).where(eq(panelRegister.jobId, jobId));
    const panelCountByLevel: Record<string, number> = {};
    for (const panel of panels) {
      const level = panel.level || "Unknown";
      panelCountByLevel[level] = (panelCountByLevel[level] || 0) + 1;
    }
    
    // Filter out empty levels if skipEmptyLevels is true
    const levelsToProcess = skipEmptyLevels 
      ? sortedLevels.filter(level => (panelCountByLevel[level] || 0) > 0)
      : sortedLevels;

    // Get level-specific cycle times
    const levelCycleTimes = await this.getJobLevelCycleTimes(jobId);
    const cycleTimeMap = new Map<string, number>(
      levelCycleTimes.map(ct => [`${ct.buildingNumber}-${ct.level}`, ct.cycleDays])
    );
    const defaultCycleTime = job.expectedCycleTimePerFloor;

    // Get factory work days and CFMEU holidays for working day calculations
    const workDays = await getFactoryWorkDays(job.factoryId);
    
    // Get factory's CFMEU calendar type (if any)
    let cfmeuCalendarType: "VIC_ONSITE" | "VIC_OFFSITE" | "QLD" | null = null;
    if (job.factoryId) {
      const [factory] = await db.select().from(factories).where(eq(factories.id, job.factoryId));
      if (factory?.cfmeuCalendar) {
        cfmeuCalendarType = factory.cfmeuCalendar;
      }
    }
    
    // Calculate date range for fetching holidays (2 years forward/back from onsite start)
    const onsiteStartBaseDate = new Date(job.productionStartDate);
    const holidayRangeStart = new Date(onsiteStartBaseDate);
    holidayRangeStart.setFullYear(holidayRangeStart.getFullYear() - 2);
    const holidayRangeEnd = new Date(onsiteStartBaseDate);
    holidayRangeEnd.setFullYear(holidayRangeEnd.getFullYear() + 2);
    
    const holidays = await getCfmeuHolidaysInRange(cfmeuCalendarType, holidayRangeStart, holidayRangeEnd);

    // Date calculation logic using WORKING DAYS:
    // 1. productionStartDate = Onsite Start Date (when builder wants us to start on site)
    // 2. Each level's onsite date = productionStartDate + cumulative WORKING days
    // 3. productionSlotDate = Onsite Date - production_days_in_advance WORKING days (Panel Production Due)
    // 
    // Full timeline (working backwards from Onsite Start Date):
    // Drafting Start → Drawing Due (IFC) → Production Window Start → Panel Production Due → Onsite Start
    // All day values are now WORKING DAYS (excludes weekends per factory config and CFMEU holidays)
    
    const productionDaysInAdvance = job.productionDaysInAdvance ?? 10;

    const createdSlots: ProductionSlot[] = [];
    let cumulativeWorkingDays = 0;
    
    for (let i = 0; i < levelsToProcess.length; i++) {
      const level = levelsToProcess[i];
      
      // Calculate onsite start date for this level using working days
      const onsiteDate = addWorkingDays(onsiteStartBaseDate, cumulativeWorkingDays, workDays, holidays);
      
      // Calculate panel production due date (when panel must be cast) using working days
      const panelProductionDue = subtractWorkingDays(onsiteDate, productionDaysInAdvance, workDays, holidays);
      
      // Get level-specific cycle time or fall back to job default
      const levelCycleTime = cycleTimeMap.get(`1-${level}`) ?? defaultCycleTime;

      const [slot] = await db.insert(productionSlots).values({
        jobId,
        buildingNumber: 1,
        level,
        levelOrder: i,
        panelCount: panelCountByLevel[level] || 0,
        productionSlotDate: panelProductionDue,
        status: "SCHEDULED",
        isBooked: false,
      }).returning();
      createdSlots.push(slot);
      
      // Add this level's cycle time (in working days) to cumulative total for next level
      cumulativeWorkingDays += levelCycleTime;
    }
    return createdSlots;
  }

  private generateLevelRange(lowestLevel: string, highestLevel: string): string[] {
    const levels: string[] = [];
    
    // Try to parse as numeric levels first
    const lowMatch = lowestLevel.match(/^L?(\d+)$/i);
    const highMatch = highestLevel.match(/^L?(\d+)$/i);
    
    if (lowMatch && highMatch) {
      const lowNum = parseInt(lowMatch[1], 10);
      const highNum = parseInt(highMatch[1], 10);
      
      // Generate levels L1, L2, ..., Ln (or just 1, 2, ..., n based on input format)
      const useLPrefix = lowestLevel.toLowerCase().startsWith('l') || highestLevel.toLowerCase().startsWith('l');
      
      for (let i = lowNum; i <= highNum; i++) {
        levels.push(useLPrefix ? `L${i}` : String(i));
      }
      return levels;
    }
    
    // Handle special named levels
    const specialLevels = ["Basement 2", "B2", "Basement 1", "B1", "Basement", "Ground", "G", "GF", "Mezzanine", "Mezz"];
    const lowIdx = specialLevels.findIndex(l => l.toLowerCase() === lowestLevel.toLowerCase());
    const highIdx = specialLevels.findIndex(l => l.toLowerCase() === highestLevel.toLowerCase());
    
    if (lowIdx !== -1 && highIdx !== -1 && lowIdx <= highIdx) {
      return specialLevels.slice(lowIdx, highIdx + 1);
    }
    
    // If we can't parse, just return both levels
    if (lowestLevel === highestLevel) {
      return [lowestLevel];
    }
    return [lowestLevel, highestLevel];
  }

  private sortLevelsIntelligently(levels: string[], lowestLevel?: string | null, highestLevel?: string | null): string[] {
    const levelOrder: Record<string, number> = {
      "Basement 2": -2, "B2": -2,
      "Basement 1": -1, "B1": -1, "Basement": -1,
      "Ground": 0, "G": 0, "GF": 0,
      "Mezzanine": 0.5, "Mezz": 0.5,
    };
    
    const parseLevelNumber = (level: string): number => {
      if (levelOrder[level] !== undefined) return levelOrder[level];
      const match = level.match(/^L?(\d+)$/i);
      if (match) return parseInt(match[1], 10);
      if (level.toLowerCase() === "roof") return 999;
      return 500; // Unknown levels go in middle
    };

    return [...levels].sort((a, b) => parseLevelNumber(a) - parseLevelNumber(b));
  }

  async adjustProductionSlot(id: string, data: { newDate: Date; reason: string; changedById: string; clientConfirmed?: boolean; cascadeToLater?: boolean }): Promise<ProductionSlot | undefined> {
    const [slot] = await db.select().from(productionSlots).where(eq(productionSlots.id, id));
    if (!slot) return undefined;

    const previousDate = slot.productionSlotDate;
    const dateDiff = data.newDate.getTime() - previousDate.getTime();
    const daysDiff = Math.round(dateDiff / (1000 * 60 * 60 * 24));

    // Record adjustment
    await db.insert(productionSlotAdjustments).values({
      productionSlotId: id,
      previousDate,
      newDate: data.newDate,
      reason: data.reason,
      changedById: data.changedById,
      clientConfirmed: data.clientConfirmed || false,
      cascadedToOtherSlots: data.cascadeToLater || false,
    });

    // Update this slot
    const [updatedSlot] = await db.update(productionSlots).set({
      productionSlotDate: data.newDate,
      status: "PENDING_UPDATE",
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();

    // Cascade to later slots if requested
    if (data.cascadeToLater && daysDiff !== 0) {
      const laterSlots = await db.select().from(productionSlots)
        .where(and(
          eq(productionSlots.jobId, slot.jobId),
          gte(productionSlots.levelOrder, slot.levelOrder),
          sql`${productionSlots.id} != ${id}`
        ));
      
      for (const laterSlot of laterSlots) {
        const newLaterDate = new Date(laterSlot.productionSlotDate);
        newLaterDate.setTime(newLaterDate.getTime() + dateDiff);
        
        await db.insert(productionSlotAdjustments).values({
          productionSlotId: laterSlot.id,
          previousDate: laterSlot.productionSlotDate,
          newDate: newLaterDate,
          reason: `Cascaded from ${slot.level} adjustment: ${data.reason}`,
          changedById: data.changedById,
          clientConfirmed: data.clientConfirmed || false,
          cascadedToOtherSlots: true,
        });

        await db.update(productionSlots).set({
          productionSlotDate: newLaterDate,
          status: "PENDING_UPDATE",
          updatedAt: new Date(),
        }).where(eq(productionSlots.id, laterSlot.id));
      }
    }

    return updatedSlot;
  }

  async bookProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    const [slot] = await db.update(productionSlots).set({
      status: "BOOKED",
      isBooked: true,
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();
    return slot;
  }

  async completeProductionSlot(id: string): Promise<ProductionSlot | undefined> {
    const [slot] = await db.update(productionSlots).set({
      status: "COMPLETED",
      updatedAt: new Date(),
    }).where(eq(productionSlots.id, id)).returning();
    return slot;
  }

  async getProductionSlotAdjustments(slotId: string): Promise<ProductionSlotAdjustmentWithDetails[]> {
    const adjustments = await db.select().from(productionSlotAdjustments)
      .where(eq(productionSlotAdjustments.productionSlotId, slotId))
      .orderBy(desc(productionSlotAdjustments.createdAt));
    
    const adjustmentsWithDetails: ProductionSlotAdjustmentWithDetails[] = [];
    for (const adj of adjustments) {
      const [changedBy] = await db.select().from(users).where(eq(users.id, adj.changedById));
      if (changedBy) {
        adjustmentsWithDetails.push({ ...adj, changedBy });
      }
    }
    return adjustmentsWithDetails;
  }

  async getJobsWithoutProductionSlots(): Promise<Job[]> {
    const jobsWithSlots = await db.selectDistinct({ jobId: productionSlots.jobId }).from(productionSlots);
    const jobIdsWithSlots = jobsWithSlots.map(j => j.jobId);
    
    if (jobIdsWithSlots.length === 0) {
      return db.select().from(jobs)
        .where(and(
          eq(jobs.status, "ACTIVE"),
          sql`${jobs.productionStartDate} IS NOT NULL`,
          sql`${jobs.expectedCycleTimePerFloor} IS NOT NULL`,
          sql`${jobs.levels} IS NOT NULL`
        ))
        .orderBy(asc(jobs.jobNumber));
    }
    
    return db.select().from(jobs)
      .where(and(
        eq(jobs.status, "ACTIVE"),
        sql`${jobs.productionStartDate} IS NOT NULL`,
        sql`${jobs.expectedCycleTimePerFloor} IS NOT NULL`,
        sql`${jobs.levels} IS NOT NULL`,
        sql`${jobs.id} NOT IN (${sql.join(jobIdsWithSlots.map(id => sql`${id}`), sql`, `)})`
      ))
      .orderBy(asc(jobs.jobNumber));
  }

  async deleteProductionSlot(id: string): Promise<void> {
    await db.delete(productionSlotAdjustments).where(eq(productionSlotAdjustments.productionSlotId, id));
    await db.delete(productionSlots).where(eq(productionSlots.id, id));
  }

  async checkAndCompleteSlotByPanelCompletion(jobId: string, level: string, buildingNumber: number): Promise<void> {
    // Get all panels for this job/level/building
    const panels = await db.select().from(panelRegister).where(and(
      eq(panelRegister.jobId, jobId),
      eq(panelRegister.level, level),
      eq(panelRegister.building, String(buildingNumber))
    ));

    // Check if all panels are completed
    const allCompleted = panels.length > 0 && panels.every(p => p.status === "COMPLETED");
    
    if (allCompleted) {
      // Find the corresponding slot
      const [slot] = await db.select().from(productionSlots).where(and(
        eq(productionSlots.jobId, jobId),
        eq(productionSlots.level, level),
        eq(productionSlots.buildingNumber, buildingNumber)
      ));
      
      if (slot && slot.status !== "COMPLETED") {
        await db.update(productionSlots).set({
          status: "COMPLETED",
          updatedAt: new Date(),
        }).where(eq(productionSlots.id, slot.id));
      }
    }
  }

  // ============== Drafting Program ==============
  async getDraftingPrograms(filters?: { jobId?: string; status?: string; assignedToId?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[] }): Promise<DraftingProgramWithDetails[]> {
    const conditions: any[] = [];
    if (filters?.jobId) conditions.push(eq(draftingProgram.jobId, filters.jobId));
    if (filters?.status) conditions.push(eq(draftingProgram.status, filters.status as any));
    if (filters?.assignedToId) conditions.push(eq(draftingProgram.assignedToId, filters.assignedToId));
    if (filters?.dateFrom) conditions.push(gte(draftingProgram.drawingDueDate, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(draftingProgram.drawingDueDate, filters.dateTo));
    
    // Filter by factory IDs through job
    if (filters?.factoryIds && filters.factoryIds.length > 0) {
      conditions.push(inArray(jobs.factoryId, filters.factoryIds));
    }
    
    // Use join to filter by factory
    const query = db.select({
      draftingProgram: draftingProgram,
      job: jobs
    })
      .from(draftingProgram)
      .innerJoin(jobs, eq(draftingProgram.jobId, jobs.id))
      .orderBy(asc(draftingProgram.drawingDueDate));
    
    const results = conditions.length > 0 
      ? await query.where(and(...conditions))
      : await query;
    
    const detailedResults: DraftingProgramWithDetails[] = [];
    for (const r of results) {
      const dp = r.draftingProgram;
      const job = r.job;
      const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, dp.panelId));
      const slot = dp.productionSlotId ? (await db.select().from(productionSlots).where(eq(productionSlots.id, dp.productionSlotId)))[0] : null;
      const assignedTo = dp.assignedToId ? (await db.select().from(users).where(eq(users.id, dp.assignedToId)))[0] : null;
      
      if (panel) {
        detailedResults.push({ ...dp, panel, job, productionSlot: slot, assignedTo });
      }
    }
    return detailedResults;
  }

  async getDraftingProgram(id: string): Promise<DraftingProgramWithDetails | undefined> {
    const [dp] = await db.select().from(draftingProgram).where(eq(draftingProgram.id, id));
    if (!dp) return undefined;
    
    const [panel] = await db.select().from(panelRegister).where(eq(panelRegister.id, dp.panelId));
    const [job] = await db.select().from(jobs).where(eq(jobs.id, dp.jobId));
    const slot = dp.productionSlotId ? (await db.select().from(productionSlots).where(eq(productionSlots.id, dp.productionSlotId)))[0] : null;
    const assignedTo = dp.assignedToId ? (await db.select().from(users).where(eq(users.id, dp.assignedToId)))[0] : null;
    
    if (!panel || !job) return undefined;
    return { ...dp, panel, job, productionSlot: slot, assignedTo };
  }

  async getDraftingProgramByPanelId(panelId: string): Promise<DraftingProgram | undefined> {
    const [dp] = await db.select().from(draftingProgram).where(eq(draftingProgram.panelId, panelId));
    return dp;
  }

  async createDraftingProgram(data: InsertDraftingProgram): Promise<DraftingProgram> {
    const [created] = await db.insert(draftingProgram).values(data).returning();
    return created;
  }

  async updateDraftingProgram(id: string, data: Partial<InsertDraftingProgram>): Promise<DraftingProgram | undefined> {
    const [updated] = await db.update(draftingProgram).set({ ...data, updatedAt: new Date() }).where(eq(draftingProgram.id, id)).returning();
    return updated;
  }

  async deleteDraftingProgram(id: string): Promise<void> {
    await db.delete(draftingProgram).where(eq(draftingProgram.id, id));
  }

  async deleteDraftingProgramByJob(jobId: string): Promise<number> {
    const result = await db.delete(draftingProgram).where(eq(draftingProgram.jobId, jobId)).returning();
    return result.length;
  }

  async generateDraftingProgramFromProductionSlots(): Promise<{ created: number; updated: number }> {
    // Get global settings as fallback defaults
    const settings = await this.getGlobalSettings();
    const defaultIfcDaysInAdvance = settings?.ifcDaysInAdvance ?? 14;
    const defaultDaysToAchieveIfc = settings?.daysToAchieveIfc ?? 21;
    
    // Drafting uses GLOBAL drafting work days only (no CFMEU calendar)
    // This is different from production which uses factory-specific work days + CFMEU calendar
    const draftingWorkDays = (settings?.draftingWorkDays as boolean[]) ?? [false, true, true, true, true, true, false];
    const noHolidays: Date[] = []; // Drafting doesn't use CFMEU calendar
    
    // Get all production slots that are not completed
    const slots = await db.select().from(productionSlots).where(
      sql`${productionSlots.status} != 'COMPLETED'`
    );
    
    // Cache job data to avoid repeated queries
    const jobCache = new Map<string, Job>();
    
    let created = 0;
    let updated = 0;
    
    for (const slot of slots) {
      // Get job data for job-level settings (use cache)
      let job = jobCache.get(slot.jobId);
      if (!job) {
        const [jobData] = await db.select().from(jobs).where(eq(jobs.id, slot.jobId));
        if (jobData) {
          job = jobData;
          jobCache.set(slot.jobId, jobData);
        }
      }
      
      // Use job-level settings or fall back to global defaults
      // All day values are now WORKING DAYS
      const ifcDaysInAdvance = job?.daysInAdvance ?? defaultIfcDaysInAdvance;
      const daysToAchieveIfc = job?.daysToAchieveIfc ?? defaultDaysToAchieveIfc;
      const productionWindowDays = job?.productionWindowDays ?? settings?.productionWindowDays ?? 10;
      
      // Get all panels for this slot's job and level
      const panels = await db.select().from(panelRegister).where(and(
        eq(panelRegister.jobId, slot.jobId),
        eq(panelRegister.level, slot.level)
      ));
      
      for (const panel of panels) {
        // Check if drafting program entry already exists for this panel
        const existing = await this.getDraftingProgramByPanelId(panel.id);
        
        // Date calculation flow (working backwards using WORKING DAYS):
        // Drafting uses global draftingWorkDays (no CFMEU calendar)
        // 1. productionSlotDate = Panel Production Due
        // 2. Production Window Start = Panel Production Due - production_window_days WORKING DAYS
        // 3. Drawing Due (IFC) = Production Window Start - ifc_days_in_advance WORKING DAYS
        // 4. Drafting Start = Drawing Due - days_to_achieve_ifc WORKING DAYS
        
        const productionDate = slot.productionSlotDate;
        
        // Calculate production window start using working days
        const productionWindowStart = subtractWorkingDays(productionDate, productionWindowDays, draftingWorkDays, noHolidays);
        
        // Drawing due date is calculated from production window start using working days
        const drawingDueDate = subtractWorkingDays(productionWindowStart, ifcDaysInAdvance, draftingWorkDays, noHolidays);
        
        // Drafting window start using working days
        const draftingWindowStart = subtractWorkingDays(drawingDueDate, daysToAchieveIfc, draftingWorkDays, noHolidays);
        
        if (existing) {
          // Update existing entry with new dates if production slot dates changed
          await this.updateDraftingProgram(existing.id, {
            productionSlotId: slot.id,
            productionDate,
            drawingDueDate,
            draftingWindowStart,
          });
          updated++;
        } else {
          // Create new entry
          await this.createDraftingProgram({
            panelId: panel.id,
            jobId: slot.jobId,
            productionSlotId: slot.id,
            level: slot.level,
            productionDate,
            drawingDueDate,
            draftingWindowStart,
            status: "NOT_SCHEDULED",
          });
          created++;
        }
      }
    }
    
    return { created, updated };
  }

  async assignDraftingResource(id: string, assignedToId: string, proposedStartDate: Date): Promise<DraftingProgram | undefined> {
    const [updated] = await db.update(draftingProgram).set({
      assignedToId,
      proposedStartDate,
      status: "SCHEDULED",
      updatedAt: new Date(),
    }).where(eq(draftingProgram.id, id)).returning();
    return updated;
  }

  // ============== Suppliers ==============
  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(asc(suppliers.name));
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [supplier] = await db.update(suppliers).set({ ...data, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return supplier;
  }

  async deleteSupplier(id: string): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // ============== Item Categories ==============
  async getAllItemCategories(): Promise<ItemCategory[]> {
    return db.select().from(itemCategories).orderBy(asc(itemCategories.name));
  }

  async getActiveItemCategories(): Promise<ItemCategory[]> {
    return db.select().from(itemCategories).where(eq(itemCategories.isActive, true)).orderBy(asc(itemCategories.name));
  }

  async getItemCategory(id: string): Promise<ItemCategory | undefined> {
    const [category] = await db.select().from(itemCategories).where(eq(itemCategories.id, id));
    return category;
  }

  async createItemCategory(data: InsertItemCategory): Promise<ItemCategory> {
    const [category] = await db.insert(itemCategories).values(data).returning();
    return category;
  }

  async updateItemCategory(id: string, data: Partial<InsertItemCategory>): Promise<ItemCategory | undefined> {
    const [category] = await db.update(itemCategories).set({ ...data, updatedAt: new Date() }).where(eq(itemCategories.id, id)).returning();
    return category;
  }

  async deleteItemCategory(id: string): Promise<void> {
    await db.delete(itemCategories).where(eq(itemCategories.id, id));
  }

  // ============== Items ==============
  async getAllItems(): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  }

  async getActiveItems(): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.isActive, true))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  }

  async getItem(id: string): Promise<ItemWithDetails | undefined> {
    const [row] = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.id, id));
    if (!row) return undefined;
    return { ...row.items, category: row.item_categories, supplier: row.suppliers };
  }

  async getItemsByCategory(categoryId: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.categoryId, categoryId))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  }

  async getItemsBySupplier(supplierId: string): Promise<ItemWithDetails[]> {
    const rows = await db.select().from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
      .where(eq(items.supplierId, supplierId))
      .orderBy(asc(items.name));
    return rows.map(r => ({ ...r.items, category: r.item_categories, supplier: r.suppliers }));
  }

  async createItem(data: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(data).returning();
    return item;
  }

  async updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [item] = await db.update(items).set({ ...data, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return item;
  }

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async bulkImportItems(itemsData: InsertItem[]): Promise<{ created: number; updated: number; errors: string[] }> {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const itemData of itemsData) {
      try {
        // Check if item with same code exists (update) or create new
        if (itemData.code) {
          const existing = await db.select().from(items).where(eq(items.code, itemData.code)).limit(1);
          if (existing.length > 0) {
            await db.update(items).set({ ...itemData, updatedAt: new Date() }).where(eq(items.id, existing[0].id));
            updated++;
            continue;
          }
        }
        
        // Create new item
        await db.insert(items).values(itemData);
        created++;
      } catch (error: any) {
        errors.push(`Error importing item ${itemData.code || itemData.name}: ${error.message}`);
      }
    }

    return { created, updated, errors };
  }

  // ============== Purchase Orders ==============
  private async getPurchaseOrderWithDetails(poId: string): Promise<PurchaseOrderWithDetails | undefined> {
    const [poRow] = await db.select().from(purchaseOrders)
      .leftJoin(users, eq(purchaseOrders.requestedById, users.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, poId));
    if (!poRow) return undefined;

    const lineItems = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, poId))
      .orderBy(asc(purchaseOrderItems.sortOrder));

    let approvedBy: User | null = null;
    let rejectedBy: User | null = null;
    if (poRow.purchase_orders.approvedById) {
      const [u] = await db.select().from(users).where(eq(users.id, poRow.purchase_orders.approvedById));
      approvedBy = u || null;
    }
    if (poRow.purchase_orders.rejectedById) {
      const [u] = await db.select().from(users).where(eq(users.id, poRow.purchase_orders.rejectedById));
      rejectedBy = u || null;
    }

    // Get attachment count
    const attachmentCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, poId));
    const attachmentCount = Number(attachmentCountResult[0]?.count || 0);

    return {
      ...poRow.purchase_orders,
      requestedBy: poRow.users!,
      approvedBy,
      rejectedBy,
      supplier: poRow.suppliers,
      items: lineItems,
      attachmentCount,
    };
  }

  async getAllPurchaseOrders(): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await this.getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  }

  async getPurchaseOrdersByStatus(status: string): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.status, status as any))
      .orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await this.getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  }

  async getPurchaseOrdersByUser(userId: string): Promise<PurchaseOrderWithDetails[]> {
    const poRows = await db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.requestedById, userId))
      .orderBy(desc(purchaseOrders.createdAt));
    const results: PurchaseOrderWithDetails[] = [];
    for (const po of poRows) {
      const details = await this.getPurchaseOrderWithDetails(po.id);
      if (details) results.push(details);
    }
    return results;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrderWithDetails | undefined> {
    return this.getPurchaseOrderWithDetails(id);
  }

  async createPurchaseOrder(data: InsertPurchaseOrder, lineItems: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails> {
    // Calculate totals from line items
    let subtotal = 0;
    const processedItems = lineItems.map((item, idx) => {
      const qty = parseFloat(String(item.quantity || 0));
      const price = parseFloat(String(item.unitPrice || 0));
      const lineTotal = qty * price;
      subtotal += lineTotal;
      return {
        ...item,
        sortOrder: item.sortOrder ?? idx,
        lineTotal: lineTotal.toFixed(2),
      };
    });
    
    const taxRate = parseFloat(String(data.taxRate || 10));
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    
    const [po] = await db.insert(purchaseOrders).values({
      ...data,
      subtotal: subtotal.toFixed(2),
      taxRate: taxRate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    }).returning();
    
    if (processedItems.length > 0) {
      await db.insert(purchaseOrderItems).values(
        processedItems.map(item => ({
          ...item,
          purchaseOrderId: po.id,
        }))
      );
    }
    
    return (await this.getPurchaseOrderWithDetails(po.id))!;
  }

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>, lineItems?: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails | undefined> {
    let updateData: any = { ...data, updatedAt: new Date() };
    
    if (lineItems !== undefined) {
      // Calculate totals from line items
      let subtotal = 0;
      const processedItems = lineItems.map((item, idx) => {
        const qty = parseFloat(String(item.quantity || 0));
        const price = parseFloat(String(item.unitPrice || 0));
        const lineTotal = qty * price;
        subtotal += lineTotal;
        return {
          ...item,
          purchaseOrderId: id,
          sortOrder: item.sortOrder ?? idx,
          lineTotal: lineTotal.toFixed(2),
        };
      });
      
      const taxRate = parseFloat(String(data.taxRate || 10));
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      
      updateData = {
        ...updateData,
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      };
      
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
      if (processedItems.length > 0) {
        await db.insert(purchaseOrderItems).values(processedItems);
      }
    }
    
    const [po] = await db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, id)).returning();
    if (!po) return undefined;
    
    return this.getPurchaseOrderWithDetails(id);
  }

  async submitPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "SUBMITTED",
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  }

  async approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "APPROVED",
      approvedById,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  }

  async rejectPurchaseOrder(id: string, rejectedById: string, reason: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.update(purchaseOrders).set({
      status: "REJECTED",
      rejectedById,
      rejectedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, id)).returning();
    return po;
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  }

  async getNextPONumber(): Promise<string> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    const count = Number(result?.count || 0) + 1;
    const year = new Date().getFullYear();
    return `PO-${year}-${String(count).padStart(4, "0")}`;
  }

  // PO Attachment Implementations
  async getPurchaseOrderAttachments(poId: string): Promise<(PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[]> {
    const attachments = await db.select().from(purchaseOrderAttachments)
      .where(eq(purchaseOrderAttachments.purchaseOrderId, poId))
      .orderBy(desc(purchaseOrderAttachments.createdAt));
    
    const result: (PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[] = [];
    for (const attachment of attachments) {
      let uploadedBy: Pick<User, 'id' | 'name' | 'email'> | null = null;
      if (attachment.uploadedById) {
        const [user] = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
        }).from(users).where(eq(users.id, attachment.uploadedById));
        uploadedBy = user || null;
      }
      result.push({ ...attachment, uploadedBy });
    }
    return result;
  }

  async getPurchaseOrderAttachment(id: string): Promise<PurchaseOrderAttachment | undefined> {
    const [attachment] = await db.select().from(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
    return attachment;
  }

  async createPurchaseOrderAttachment(data: InsertPurchaseOrderAttachment): Promise<PurchaseOrderAttachment> {
    const [attachment] = await db.insert(purchaseOrderAttachments).values(data).returning();
    return attachment;
  }

  async deletePurchaseOrderAttachment(id: string): Promise<void> {
    await db.delete(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.id, id));
  }

  // Task Management (Monday.com-style) Implementations
  private async getTaskWithDetails(taskId: string): Promise<TaskWithDetails | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
    if (!task) return undefined;

    const assigneesResult = await db.select()
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(eq(taskAssignees.taskId, taskId));
    
    const assignees = assigneesResult.map(r => ({
      ...r.task_assignees,
      user: r.users,
    }));

    const subtasksResult = await db.select().from(tasks)
      .where(eq(tasks.parentId, taskId))
      .orderBy(asc(tasks.sortOrder));

    const [updatesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(taskUpdates)
      .where(eq(taskUpdates.taskId, taskId));

    const [filesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(taskFiles)
      .where(eq(taskFiles.taskId, taskId));

    let createdBy: User | null = null;
    if (task.createdById) {
      const [creator] = await db.select().from(users).where(eq(users.id, task.createdById));
      createdBy = creator || null;
    }

    let job: Job | null = null;
    if (task.jobId) {
      const [jobResult] = await db.select().from(jobs).where(eq(jobs.id, task.jobId));
      job = jobResult || null;
    }

    return {
      ...task,
      assignees,
      subtasks: subtasksResult,
      updatesCount: Number(updatesCount?.count || 0),
      filesCount: Number(filesCount?.count || 0),
      createdBy,
      job,
    };
  }

  async getAllTaskGroups(): Promise<TaskGroupWithTasks[]> {
    const groups = await db.select().from(taskGroups).orderBy(asc(taskGroups.sortOrder));
    
    const result: TaskGroupWithTasks[] = [];
    for (const group of groups) {
      const groupTasks = await db.select().from(tasks)
        .where(and(eq(tasks.groupId, group.id), sql`${tasks.parentId} IS NULL`))
        .orderBy(asc(tasks.sortOrder));

      const tasksWithDetails: TaskWithDetails[] = [];
      for (const task of groupTasks) {
        const taskDetails = await this.getTaskWithDetails(task.id);
        if (taskDetails) {
          tasksWithDetails.push(taskDetails);
        }
      }

      result.push({
        ...group,
        tasks: tasksWithDetails,
      });
    }

    return result;
  }

  async getTaskGroup(id: string): Promise<TaskGroupWithTasks | undefined> {
    const [group] = await db.select().from(taskGroups).where(eq(taskGroups.id, id));
    if (!group) return undefined;

    const groupTasks = await db.select().from(tasks)
      .where(and(eq(tasks.groupId, id), sql`${tasks.parentId} IS NULL`))
      .orderBy(asc(tasks.sortOrder));

    const tasksWithDetails: TaskWithDetails[] = [];
    for (const task of groupTasks) {
      const taskDetails = await this.getTaskWithDetails(task.id);
      if (taskDetails) {
        tasksWithDetails.push(taskDetails);
      }
    }

    return {
      ...group,
      tasks: tasksWithDetails,
    };
  }

  async createTaskGroup(data: InsertTaskGroup): Promise<TaskGroup> {
    const [maxOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` }).from(taskGroups);
    const [group] = await db.insert(taskGroups).values({
      ...data,
      sortOrder: (maxOrder?.maxOrder || 0) + 1,
    }).returning();
    return group;
  }

  async updateTaskGroup(id: string, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined> {
    const [group] = await db.update(taskGroups).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(taskGroups.id, id)).returning();
    return group;
  }

  async deleteTaskGroup(id: string): Promise<void> {
    await db.delete(taskGroups).where(eq(taskGroups.id, id));
  }

  async reorderTaskGroups(groupIds: string[]): Promise<void> {
    for (let i = 0; i < groupIds.length; i++) {
      await db.update(taskGroups).set({ sortOrder: i, updatedAt: new Date() }).where(eq(taskGroups.id, groupIds[i]));
    }
  }

  async getTask(id: string): Promise<TaskWithDetails | undefined> {
    return this.getTaskWithDetails(id);
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [maxOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(tasks)
      .where(eq(tasks.groupId, data.groupId));
    const [task] = await db.insert(tasks).values({
      ...data,
      sortOrder: (maxOrder?.maxOrder || 0) + 1,
    }).returning();
    return task;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(tasks.id, id)).returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async reorderTasks(groupId: string, taskIds: string[]): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      await db.update(tasks).set({ sortOrder: i, updatedAt: new Date() }).where(eq(tasks.id, taskIds[i]));
    }
  }

  async getTaskAssignees(taskId: string): Promise<(TaskAssignee & { user: User })[]> {
    const result = await db.select()
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(eq(taskAssignees.taskId, taskId));
    
    return result.map(r => ({
      ...r.task_assignees,
      user: r.users,
    }));
  }

  async setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]> {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    
    for (const userId of userIds) {
      await db.insert(taskAssignees).values({ taskId, userId }).onConflictDoNothing();
    }
    
    return this.getTaskAssignees(taskId);
  }

  async getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User })[]> {
    const result = await db.select()
      .from(taskUpdates)
      .innerJoin(users, eq(taskUpdates.userId, users.id))
      .where(eq(taskUpdates.taskId, taskId))
      .orderBy(desc(taskUpdates.createdAt));
    
    return result.map(r => ({
      ...r.task_updates,
      user: r.users,
    }));
  }

  async createTaskUpdate(data: InsertTaskUpdate): Promise<TaskUpdate> {
    const [update] = await db.insert(taskUpdates).values(data).returning();
    return update;
  }

  async deleteTaskUpdate(id: string): Promise<void> {
    await db.delete(taskUpdates).where(eq(taskUpdates.id, id));
  }

  async getTaskFiles(taskId: string): Promise<(TaskFile & { uploadedBy?: User | null })[]> {
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId)).orderBy(desc(taskFiles.createdAt));
    
    const result: (TaskFile & { uploadedBy?: User | null })[] = [];
    for (const file of files) {
      let uploadedBy: User | null = null;
      if (file.uploadedById) {
        const [user] = await db.select().from(users).where(eq(users.id, file.uploadedById));
        uploadedBy = user || null;
      }
      result.push({ ...file, uploadedBy });
    }
    return result;
  }

  async createTaskFile(data: InsertTaskFile): Promise<TaskFile> {
    const [file] = await db.insert(taskFiles).values(data).returning();
    return file;
  }

  async deleteTaskFile(id: string): Promise<void> {
    await db.delete(taskFiles).where(eq(taskFiles.id, id));
  }

  // Task Notification Implementations
  async getTaskNotifications(userId: string): Promise<any[]> {
    const notifications = await db.select().from(taskNotifications)
      .where(eq(taskNotifications.userId, userId))
      .orderBy(desc(taskNotifications.createdAt))
      .limit(50);
    
    const result = [];
    for (const notif of notifications) {
      let fromUser: User | null = null;
      let task: Task | null = null;
      
      if (notif.fromUserId) {
        const [u] = await db.select().from(users).where(eq(users.id, notif.fromUserId));
        fromUser = u || null;
      }
      const [t] = await db.select().from(tasks).where(eq(tasks.id, notif.taskId));
      task = t || null;
      
      result.push({ ...notif, fromUser, task });
    }
    return result;
  }

  async getTaskNotificationById(id: string): Promise<any | null> {
    const [notification] = await db.select().from(taskNotifications)
      .where(eq(taskNotifications.id, id));
    return notification || null;
  }

  async getUnreadTaskNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(taskNotifications)
      .where(and(
        eq(taskNotifications.userId, userId),
        sql`${taskNotifications.readAt} IS NULL`
      ));
    return Number(result[0]?.count || 0);
  }

  async markTaskNotificationRead(id: string): Promise<void> {
    await db.update(taskNotifications)
      .set({ readAt: new Date() })
      .where(eq(taskNotifications.id, id));
  }

  async markAllTaskNotificationsRead(userId: string): Promise<void> {
    await db.update(taskNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(taskNotifications.userId, userId),
        sql`${taskNotifications.readAt} IS NULL`
      ));
  }

  async createTaskNotificationsForAssignees(
    taskId: string, 
    excludeUserId: string, 
    type: string, 
    title: string, 
    body: string | null, 
    updateId: string | null
  ): Promise<void> {
    // Get all assignees for this task
    const assignees = await db.select().from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));
    
    // Create notifications for each assignee except the sender
    for (const assignee of assignees) {
      if (assignee.userId !== excludeUserId) {
        await db.insert(taskNotifications).values({
          userId: assignee.userId,
          taskId,
          updateId,
          type: type as any,
          title,
          body,
          fromUserId: excludeUserId,
        });
      }
    }
  }

  // Job Level Cycle Times
  async getJobLevelCycleTimes(jobId: string): Promise<JobLevelCycleTime[]> {
    return db.select().from(jobLevelCycleTimes)
      .where(eq(jobLevelCycleTimes.jobId, jobId))
      .orderBy(asc(jobLevelCycleTimes.buildingNumber), asc(jobLevelCycleTimes.levelOrder));
  }

  async saveJobLevelCycleTimes(jobId: string, cycleTimes: { buildingNumber: number; level: string; levelOrder: number; cycleDays: number }[]): Promise<void> {
    await db.delete(jobLevelCycleTimes).where(eq(jobLevelCycleTimes.jobId, jobId));
    
    if (cycleTimes.length > 0) {
      await db.insert(jobLevelCycleTimes).values(
        cycleTimes.map(ct => ({
          jobId,
          buildingNumber: ct.buildingNumber,
          level: ct.level,
          levelOrder: ct.levelOrder,
          cycleDays: ct.cycleDays,
        }))
      );
    }
  }

  async getJobLevelCycleTime(jobId: string, buildingNumber: number, level: string): Promise<JobLevelCycleTime | null> {
    const [result] = await db.select().from(jobLevelCycleTimes)
      .where(and(
        eq(jobLevelCycleTimes.jobId, jobId),
        eq(jobLevelCycleTimes.buildingNumber, buildingNumber),
        eq(jobLevelCycleTimes.level, level)
      ));
    return result || null;
  }
}

export const storage = new DatabaseStorage();
