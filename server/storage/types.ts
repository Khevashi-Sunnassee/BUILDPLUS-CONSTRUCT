import type {
  User, Device, MappingRule, DailyLog, LogRow, Job, PanelRegister, ApprovalEvent,
  InsertUser, InsertDevice, InsertMappingRule, InsertDailyLog, InsertLogRow, InsertApprovalEvent,
  GlobalSettings, InsertJob, InsertPanelRegister, ProductionEntry, InsertProductionEntry,
  ProductionDay, InsertProductionDay, PanelTypeConfig, InsertPanelType,
  JobPanelRate, InsertJobPanelRate, WorkType, InsertWorkType,
  PanelTypeCostComponent, InsertPanelTypeCostComponent,
  JobCostOverride, InsertJobCostOverride,
  TrailerType, InsertTrailerType, LoadList, InsertLoadList, LoadListPanel, InsertLoadListPanel,
  DeliveryRecord, InsertDeliveryRecord,
  LoadReturn, InsertLoadReturn, LoadReturnPanel,
  WeeklyWageReport, InsertWeeklyWageReport,
  UserPermission, FunctionKey, PermissionLevel,
  WeeklyJobReport, InsertWeeklyJobReport,
  WeeklyJobReportSchedule, InsertWeeklyJobReportSchedule,
  Zone, InsertZone,
  ProductionSlot, InsertProductionSlot,
  ProductionSlotAdjustment,
  DraftingProgram, InsertDraftingProgram,
  Customer, InsertCustomer,
  Supplier, InsertSupplier,
  ItemCategory, InsertItemCategory,
  Item, InsertItem, ConstructionStage,
  PurchaseOrder, InsertPurchaseOrder,
  PurchaseOrderItem, InsertPurchaseOrderItem,
  PurchaseOrderAttachment, InsertPurchaseOrderAttachment,
  TaskGroup, InsertTaskGroup,
  Task, InsertTask,
  TaskAssignee,
  TaskGroupMember,
  TaskUpdate, InsertTaskUpdate,
  TaskFile, InsertTaskFile,
  Company, InsertCompany,
  DocumentTypeConfig, InsertDocumentType,
  DocumentTypeStatus, InsertDocumentTypeStatus,
  DocumentDiscipline, InsertDocumentDiscipline,
  DocumentCategory, InsertDocumentCategory,
  Document, InsertDocument, DocumentWithDetails,
  DocumentBundle, InsertDocumentBundle, DocumentBundleWithItems,
  DocumentBundleItem,
  BroadcastTemplate, InsertBroadcastTemplate,
  BroadcastMessage, InsertBroadcastMessage, BroadcastMessageWithDetails,
  BroadcastDelivery,
  EotClaim, InsertEotClaim,
  Employee, InsertEmployee,
  EmployeeEmployment, InsertEmployeeEmployment,
  EmployeeDocument, InsertEmployeeDocument,
  EmployeeLicence, InsertEmployeeLicence,
} from "@shared/schema";

export interface WorkingDaysConfig {
  workDays: boolean[];
  holidays: Date[];
}

export interface WeeklyJobReportWithDetails extends WeeklyJobReport {
  projectManager: User;
  approvedBy?: User | null;
  schedules: (WeeklyJobReportSchedule & { job: Job })[];
}

export interface EotClaimWithDetails extends EotClaim {
  job: Job;
  createdBy: User;
  reviewedBy?: User | null;
}

export interface LoadReturnWithDetails extends LoadReturn {
  returnedBy?: User | null;
  panels: (LoadReturnPanel & { panel: PanelRegister })[];
}

export interface LoadListWithDetails extends LoadList {
  job: Job;
  trailerType?: TrailerType | null;
  panels: (LoadListPanel & { panel: PanelRegister })[];
  deliveryRecord?: DeliveryRecord | null;
  loadReturn?: LoadReturnWithDetails | null;
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
  constructionStage?: ConstructionStage | null;
}

export interface TaskWithDetails extends Task {
  assignees: (TaskAssignee & { user: User })[];
  subtasks: TaskWithDetails[];
  updatesCount: number;
  filesCount: number;
  createdBy?: User | null;
  job?: Job | null;
}

export interface TaskGroupWithTasks extends TaskGroup {
  tasks: TaskWithDetails[];
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password?: string }): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser & { isActive?: boolean; password?: string }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  validatePassword(user: User, password: string): Promise<boolean>;
  updateUserSettings(userId: string, settings: { selectedFactoryIds?: string[] | null; defaultFactoryId?: string | null }): Promise<void>;

  getDepartment(id: string): Promise<any | undefined>;
  getDepartmentsByCompany(companyId: string): Promise<any[]>;
  createDepartment(data: any): Promise<any>;
  updateDepartment(id: string, data: any): Promise<any | undefined>;
  deleteDepartment(id: string): Promise<void>;

  getDevice(id: string): Promise<(Device & { user: User }) | undefined>;
  getDeviceByApiKey(apiKeyHash: string): Promise<(Device & { user: User }) | undefined>;
  createDevice(data: { userId: string; deviceName: string; os: string }): Promise<{ device: Device; deviceKey: string }>;
  updateDevice(id: string, data: Partial<{ deviceName: string; os: string; agentVersion: string; lastSeenAt: Date; isActive: boolean }>): Promise<Device | undefined>;
  deleteDevice(id: string): Promise<void>;
  getAllDevices(companyId?: string): Promise<(Device & { user: User })[]>;

  createMappingRule(data: InsertMappingRule): Promise<MappingRule>;
  deleteMappingRule(id: string): Promise<void>;
  getMappingRule(id: string): Promise<MappingRule | undefined>;
  getMappingRules(companyId?: string): Promise<MappingRule[]>;

  getDailyLog(id: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User }) | undefined>;
  getDailyLogsByUser(userId: string, filters?: { status?: string; dateRange?: string }): Promise<DailyLog[]>;
  getSubmittedDailyLogs(companyId?: string): Promise<(DailyLog & { rows: (LogRow & { job?: Job })[]; user: User })[]>;
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

  getGlobalSettings(companyId?: string): Promise<GlobalSettings | undefined>;
  updateGlobalSettings(data: Partial<GlobalSettings>, companyId?: string): Promise<GlobalSettings>;

  getDashboardStats(userId: string): Promise<any>;
  getReports(period: string, companyId?: string): Promise<any>;

  getJob(id: string): Promise<(Job & { panels: PanelRegister[] }) | undefined>;
  getJobByNumber(jobNumber: string): Promise<Job | undefined>;
  createJob(data: InsertJob): Promise<Job>;
  updateJob(id: string, data: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  getAllJobs(): Promise<(Job & { panels: PanelRegister[]; mappingRules: MappingRule[] })[]>;
  importJobs(data: InsertJob[]): Promise<{ imported: number; skipped: number }>;

  getPanelRegisterItem(id: string): Promise<(PanelRegister & { job: Job }) | undefined>;
  getPanelsByJob(jobId: string, includeRetired?: boolean): Promise<PanelRegister[]>;
  getPanelsByJobAndLevel(jobId: string, level: string, includeRetired?: boolean): Promise<PanelRegister[]>;
  createPanelRegisterItem(data: InsertPanelRegister): Promise<PanelRegister>;
  updatePanelRegisterItem(id: string, data: Partial<InsertPanelRegister>): Promise<PanelRegister | undefined>;
  deletePanelRegisterItem(id: string): Promise<void>;
  getAllPanelRegisterItems(companyId?: string): Promise<(PanelRegister & { job: Job })[]>;
  getPaginatedPanelRegisterItems(options: { page: number; limit: number; jobId?: string; search?: string; status?: string; documentStatus?: string; factoryId?: string }): Promise<{ panels: (PanelRegister & { job: Job })[]; total: number; page: number; limit: number; totalPages: number }>;
  importPanelRegister(data: InsertPanelRegister[]): Promise<{ imported: number; skipped: number; importedIds: string[] }>;
  updatePanelActualHours(panelId: string, additionalMinutes: number): Promise<void>;
  getPanelCountsBySource(companyId?: string): Promise<{ source: number; count: number }[]>;
  panelsWithSourceHaveRecords(source: number): Promise<boolean>;
  deletePanelsBySource(source: number): Promise<number>;
  deletePanelsByJobAndSource(jobId: string, source: number): Promise<number>;
  getExistingPanelSourceIds(jobId: string): Promise<Set<string>>;
  importEstimatePanels(data: any[]): Promise<{ imported: number; errors: string[]; importedIds: string[] }>;

  getProductionEntry(id: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job }) | undefined>;
  getProductionEntriesByDate(date: string, companyId?: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesByDateAndFactory(date: string, factory: string, companyId?: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesByDateAndFactoryId(date: string, factoryId: string, companyId?: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionEntriesInRange(startDate: string, endDate: string, companyId?: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  createProductionEntry(data: InsertProductionEntry): Promise<ProductionEntry>;
  updateProductionEntry(id: string, data: Partial<InsertProductionEntry>): Promise<ProductionEntry | undefined>;
  deleteProductionEntry(id: string): Promise<void>;
  getProductionEntryByPanelId(panelId: string): Promise<ProductionEntry | undefined>;
  getAllProductionEntries(companyId?: string): Promise<(ProductionEntry & { panel: PanelRegister; job: Job; user: User })[]>;
  getProductionSummaryByDate(date: string, companyId?: string): Promise<{ panelType: string; count: number; totalVolumeM3: number; totalAreaM2: number }[]>;
  
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
  getAllPanelTypes(companyId?: string): Promise<PanelTypeConfig[]>;

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
  getAllWorkTypes(companyId?: string): Promise<WorkType[]>;
  getActiveWorkTypes(companyId?: string): Promise<WorkType[]>;

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
  getPanelsReadyForLoading(companyId?: string): Promise<(PanelRegister & { job: Job })[]>;
  getPanelsApprovedForProduction(jobId?: string): Promise<(PanelRegister & { job: Job })[]>;

  getAllTrailerTypes(companyId?: string): Promise<TrailerType[]>;
  getActiveTrailerTypes(companyId?: string): Promise<TrailerType[]>;
  getTrailerType(id: string): Promise<TrailerType | undefined>;
  createTrailerType(data: InsertTrailerType): Promise<TrailerType>;
  updateTrailerType(id: string, data: Partial<InsertTrailerType>): Promise<TrailerType | undefined>;
  deleteTrailerType(id: string): Promise<void>;

  getAllLoadLists(companyId?: string): Promise<LoadListWithDetails[]>;
  getLoadList(id: string): Promise<LoadListWithDetails | undefined>;
  createLoadList(data: InsertLoadList, panelIds: string[]): Promise<LoadListWithDetails>;
  updateLoadList(id: string, data: Partial<InsertLoadList>): Promise<LoadList | undefined>;
  deleteLoadList(id: string): Promise<void>;
  addPanelToLoadList(loadListId: string, panelId: string, sequence?: number): Promise<LoadListPanel>;
  removePanelFromLoadList(loadListId: string, panelId: string): Promise<void>;
  getLoadListPanels(loadListId: string): Promise<(LoadListPanel & { panel: PanelRegister })[]>;

  getDeliveryRecord(loadListId: string): Promise<DeliveryRecord | undefined>;
  getDeliveryRecordById(id: string): Promise<DeliveryRecord | undefined>;
  createDeliveryRecord(data: InsertDeliveryRecord): Promise<DeliveryRecord>;
  updateDeliveryRecord(id: string, data: Partial<InsertDeliveryRecord>): Promise<DeliveryRecord | undefined>;

  getLoadReturn(loadListId: string): Promise<LoadReturnWithDetails | null>;
  createLoadReturn(data: InsertLoadReturn, panelIds: string[]): Promise<LoadReturnWithDetails>;

  getWeeklyWageReports(startDate?: string, endDate?: string, companyId?: string): Promise<WeeklyWageReport[]>;
  getWeeklyWageReport(id: string): Promise<WeeklyWageReport | undefined>;
  getWeeklyWageReportByWeek(weekStartDate: string, weekEndDate: string, factory: string, companyId?: string): Promise<WeeklyWageReport | undefined>;
  getWeeklyWageReportByWeekAndFactoryId(weekStartDate: string, weekEndDate: string, factoryId: string, companyId?: string): Promise<WeeklyWageReport | undefined>;
  createWeeklyWageReport(data: InsertWeeklyWageReport & { createdById: string }): Promise<WeeklyWageReport>;
  updateWeeklyWageReport(id: string, data: Partial<InsertWeeklyWageReport>): Promise<WeeklyWageReport | undefined>;
  deleteWeeklyWageReport(id: string): Promise<void>;

  getWeeklyJobReports(projectManagerId?: string, companyId?: string): Promise<WeeklyJobReportWithDetails[]>;
  getWeeklyJobReport(id: string): Promise<WeeklyJobReportWithDetails | undefined>;
  getWeeklyJobReportsByStatus(status: string, companyId?: string): Promise<WeeklyJobReportWithDetails[]>;
  createWeeklyJobReport(data: InsertWeeklyJobReport, schedules: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails>;
  updateWeeklyJobReport(id: string, data: Partial<InsertWeeklyJobReport>, schedules?: Omit<InsertWeeklyJobReportSchedule, "reportId">[]): Promise<WeeklyJobReportWithDetails | undefined>;
  submitWeeklyJobReport(id: string): Promise<WeeklyJobReport | undefined>;
  approveWeeklyJobReport(id: string, approvedById: string): Promise<WeeklyJobReport | undefined>;
  rejectWeeklyJobReport(id: string, approvedById: string, rejectionReason: string): Promise<WeeklyJobReport | undefined>;
  deleteWeeklyJobReport(id: string): Promise<void>;
  getJobsForProjectManager(projectManagerId: string): Promise<Job[]>;
  getApprovedWeeklyJobReports(companyId?: string): Promise<WeeklyJobReportWithDetails[]>;

  getEotClaims(companyId?: string): Promise<EotClaimWithDetails[]>;
  getEotClaim(id: string): Promise<EotClaimWithDetails | undefined>;
  getEotClaimsByJob(jobId: string): Promise<EotClaimWithDetails[]>;
  createEotClaim(data: InsertEotClaim): Promise<EotClaim>;
  updateEotClaim(id: string, data: Partial<InsertEotClaim>): Promise<EotClaim | undefined>;
  submitEotClaim(id: string): Promise<EotClaim | undefined>;
  approveEotClaim(id: string, reviewedById: string, reviewNotes: string, approvedDays: number): Promise<EotClaim | undefined>;
  rejectEotClaim(id: string, reviewedById: string, reviewNotes: string): Promise<EotClaim | undefined>;
  deleteEotClaim(id: string): Promise<void>;
  getNextEotClaimNumber(jobId: string): Promise<string>;

  getUserPermissions(userId: string): Promise<UserPermission[]>;
  getUserPermission(userId: string, functionKey: FunctionKey): Promise<UserPermission | undefined>;
  setUserPermission(userId: string, functionKey: FunctionKey, permissionLevel: PermissionLevel): Promise<UserPermission>;
  deleteUserPermission(userId: string, functionKey: FunctionKey): Promise<void>;
  initializeUserPermissions(userId: string): Promise<UserPermission[]>;
  getAllUserPermissionsForAdmin(companyId?: string): Promise<{ user: User; permissions: UserPermission[] }[]>;

  getAllZones(companyId?: string): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  getZoneByCode(code: string): Promise<Zone | undefined>;
  createZone(data: InsertZone): Promise<Zone>;
  updateZone(id: string, data: Partial<InsertZone>): Promise<Zone | undefined>;
  deleteZone(id: string): Promise<void>;

  getProductionSlots(filters?: { jobId?: string; status?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[]; companyId?: string }): Promise<ProductionSlotWithDetails[]>;
  getProductionSlot(id: string): Promise<ProductionSlotWithDetails | undefined>;
  checkPanelLevelCoverage(jobId: string): Promise<{ jobLevels: number; panelLevels: number; highestJobLevel: string; highestPanelLevel: string; hasMismatch: boolean; emptyLevels: string[] }>;
  generateProductionSlotsForJob(jobId: string, skipEmptyLevels?: boolean): Promise<ProductionSlot[]>;
  adjustProductionSlot(id: string, data: { newDate: Date; reason: string; changedById: string; clientConfirmed?: boolean; cascadeToLater?: boolean }): Promise<ProductionSlot | undefined>;
  bookProductionSlot(id: string): Promise<ProductionSlot | undefined>;
  completeProductionSlot(id: string): Promise<ProductionSlot | undefined>;
  getProductionSlotAdjustments(slotId: string): Promise<ProductionSlotAdjustmentWithDetails[]>;
  getJobsWithoutProductionSlots(companyId?: string): Promise<Job[]>;
  deleteProductionSlot(id: string): Promise<void>;
  checkAndCompleteSlotByPanelCompletion(jobId: string, level: string, buildingNumber: number): Promise<void>;

  getDraftingPrograms(filters?: { jobId?: string; status?: string; assignedToId?: string; dateFrom?: Date; dateTo?: Date; factoryIds?: string[]; companyId?: string }): Promise<DraftingProgramWithDetails[]>;
  getDraftingProgram(id: string): Promise<DraftingProgramWithDetails | undefined>;
  getDraftingProgramByPanelId(panelId: string): Promise<DraftingProgram | undefined>;
  createDraftingProgram(data: InsertDraftingProgram): Promise<DraftingProgram>;
  updateDraftingProgram(id: string, data: Partial<InsertDraftingProgram>): Promise<DraftingProgram | undefined>;
  deleteDraftingProgram(id: string): Promise<void>;
  deleteDraftingProgramByJob(jobId: string): Promise<number>;
  generateDraftingProgramFromProductionSlots(companyId?: string): Promise<{ created: number; updated: number }>;
  assignDraftingResource(id: string, assignedToId: string, proposedStartDate: Date): Promise<DraftingProgram | undefined>;

  getAllCustomers(companyId?: string): Promise<Customer[]>;
  getActiveCustomers(companyId?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;

  getAllSuppliers(): Promise<Supplier[]>;
  getActiveSuppliers(): Promise<Supplier[]>;
  getEquipmentHireSuppliers(companyId: string): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<void>;

  getAllItemCategories(companyId?: string): Promise<ItemCategory[]>;
  getActiveItemCategories(companyId?: string): Promise<ItemCategory[]>;
  getItemCategory(id: string): Promise<ItemCategory | undefined>;
  createItemCategory(data: InsertItemCategory): Promise<ItemCategory>;
  updateItemCategory(id: string, data: Partial<InsertItemCategory>): Promise<ItemCategory | undefined>;
  deleteItemCategory(id: string): Promise<void>;

  getAllItems(companyId?: string): Promise<ItemWithDetails[]>;
  getActiveItems(companyId?: string): Promise<ItemWithDetails[]>;
  getItem(id: string): Promise<ItemWithDetails | undefined>;
  getItemsByCategory(categoryId: string): Promise<ItemWithDetails[]>;
  getItemsBySupplier(supplierId: string): Promise<ItemWithDetails[]>;
  createItem(data: InsertItem): Promise<Item>;
  updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<void>;
  bulkImportItems(itemsData: InsertItem[]): Promise<{ created: number; updated: number; errors: string[] }>;

  getAllPurchaseOrders(companyId?: string): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrdersByStatus(status: string, companyId?: string): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrdersByUser(userId: string): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrderWithDetails | undefined>;
  createPurchaseOrder(data: InsertPurchaseOrder, lineItems: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails>;
  updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>, lineItems?: Omit<InsertPurchaseOrderItem, "purchaseOrderId">[]): Promise<PurchaseOrderWithDetails | undefined>;
  submitPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  approvePurchaseOrder(id: string, approvedById: string): Promise<PurchaseOrder | undefined>;
  rejectPurchaseOrder(id: string, rejectedById: string, reason: string): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<void>;
  getNextPONumber(companyId?: string): Promise<string>;

  getPurchaseOrderAttachments(poId: string): Promise<(PurchaseOrderAttachment & { uploadedBy?: Pick<User, 'id' | 'name' | 'email'> | null })[]>;
  getPurchaseOrderAttachment(id: string): Promise<PurchaseOrderAttachment | undefined>;
  createPurchaseOrderAttachment(data: InsertPurchaseOrderAttachment): Promise<PurchaseOrderAttachment>;
  deletePurchaseOrderAttachment(id: string): Promise<void>;

  getAllTaskGroups(companyId?: string, userId?: string): Promise<TaskGroupWithTasks[]>;
  getTaskGroup(id: string): Promise<TaskGroupWithTasks | undefined>;
  createTaskGroup(data: InsertTaskGroup): Promise<TaskGroup>;
  updateTaskGroup(id: string, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined>;
  deleteTaskGroup(id: string): Promise<void>;
  reorderTaskGroups(groupIds: string[]): Promise<void>;

  getTask(id: string): Promise<TaskWithDetails | undefined>;
  getTasksByActivity(activityId: string, companyId?: string): Promise<TaskWithDetails[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(groupId: string, taskIds: string[]): Promise<void>;
  moveTaskToGroup(taskId: string, targetGroupId: string, targetIndex: number): Promise<Task | undefined>;

  getTaskAssignees(taskId: string): Promise<(TaskAssignee & { user: User })[]>;
  setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]>;

  getTaskGroupMembers(groupId: string): Promise<(TaskGroupMember & { user: User })[]>;
  setTaskGroupMembers(groupId: string, userIds: string[]): Promise<(TaskGroupMember & { user: User })[]>;

  getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User; files?: TaskFile[] })[]>;
  getTaskUpdate(id: string): Promise<TaskUpdate | undefined>;
  createTaskUpdate(data: InsertTaskUpdate): Promise<TaskUpdate>;
  deleteTaskUpdate(id: string): Promise<void>;

  getTaskFiles(taskId: string): Promise<(TaskFile & { uploadedBy?: User | null })[]>;
  getTaskFile(id: string): Promise<TaskFile | undefined>;
  createTaskFile(data: InsertTaskFile): Promise<TaskFile>;
  deleteTaskFile(id: string): Promise<void>;

  getTaskNotifications(userId: string): Promise<any[]>;
  getUnreadTaskNotificationCount(userId: string): Promise<number>;
  markTaskNotificationRead(id: string): Promise<void>;
  markAllTaskNotificationsRead(userId: string): Promise<void>;
  createTaskNotificationsForAssignees(taskId: string, excludeUserId: string, type: string, title: string, body: string | null, updateId: string | null): Promise<void>;

  getAllDocumentTypes(companyId?: string): Promise<DocumentTypeConfig[]>;
  getActiveDocumentTypes(companyId?: string): Promise<DocumentTypeConfig[]>;
  getDocumentType(id: string): Promise<DocumentTypeConfig | undefined>;
  createDocumentType(data: InsertDocumentType): Promise<DocumentTypeConfig>;
  updateDocumentType(id: string, data: Partial<InsertDocumentType>): Promise<DocumentTypeConfig | undefined>;
  deleteDocumentType(id: string): Promise<void>;
  
  getDocumentTypeStatuses(typeId: string): Promise<DocumentTypeStatus[]>;
  createDocumentTypeStatus(data: InsertDocumentTypeStatus): Promise<DocumentTypeStatus>;
  updateDocumentTypeStatus(id: string, data: Partial<InsertDocumentTypeStatus>): Promise<DocumentTypeStatus | undefined>;
  deleteDocumentTypeStatus(id: string): Promise<void>;
  
  getAllDocumentDisciplines(companyId?: string): Promise<DocumentDiscipline[]>;
  getActiveDocumentDisciplines(companyId?: string): Promise<DocumentDiscipline[]>;
  getDocumentDiscipline(id: string): Promise<DocumentDiscipline | undefined>;
  createDocumentDiscipline(data: InsertDocumentDiscipline): Promise<DocumentDiscipline>;
  updateDocumentDiscipline(id: string, data: Partial<InsertDocumentDiscipline>): Promise<DocumentDiscipline | undefined>;
  deleteDocumentDiscipline(id: string): Promise<void>;
  
  getAllDocumentCategories(companyId?: string): Promise<DocumentCategory[]>;
  getActiveDocumentCategories(companyId?: string): Promise<DocumentCategory[]>;
  getDocumentCategory(id: string): Promise<DocumentCategory | undefined>;
  createDocumentCategory(data: InsertDocumentCategory): Promise<DocumentCategory>;
  updateDocumentCategory(id: string, data: Partial<InsertDocumentCategory>): Promise<DocumentCategory | undefined>;
  deleteDocumentCategory(id: string): Promise<void>;
  
  getDocuments(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    typeId?: string;
    disciplineId?: string;
    categoryId?: string;
    jobId?: string;
    panelId?: string;
    supplierId?: string;
    purchaseOrderId?: string;
    taskId?: string;
    conversationId?: string;
    messageId?: string;
    showLatestOnly?: boolean;
  }): Promise<{ documents: DocumentWithDetails[]; total: number; page: number; limit: number; totalPages: number }>;
  getDocument(id: string): Promise<DocumentWithDetails | undefined>;
  getDocumentsByIds(ids: string[]): Promise<DocumentWithDetails[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<void>;
  getNextDocumentNumber(typeId: string): Promise<string>;
  getDocumentVersionHistory(documentId: string): Promise<Document[]>;
  createNewVersion(parentDocumentId: string, data: InsertDocument): Promise<Document>;
  
  getAllDocumentBundles(companyId?: string): Promise<DocumentBundleWithItems[]>;
  getDocumentBundle(id: string): Promise<DocumentBundleWithItems | undefined>;
  getDocumentBundleByQr(qrCodeId: string): Promise<DocumentBundleWithItems | undefined>;
  createDocumentBundle(data: InsertDocumentBundle): Promise<DocumentBundle>;
  updateDocumentBundle(id: string, data: Partial<InsertDocumentBundle>): Promise<DocumentBundle | undefined>;
  deleteDocumentBundle(id: string): Promise<void>;
  addDocumentsToBundle(bundleId: string, documentIds: string[], addedBy: string): Promise<DocumentBundleItem[]>;
  removeDocumentFromBundle(bundleId: string, documentId: string): Promise<void>;
  
  logBundleAccess(bundleId: string, accessType: string, documentId?: string, ipAddress?: string, userAgent?: string): Promise<void>;
  getBundleAccessLogs(bundleId: string): Promise<any[]>;

  getBroadcastTemplates(companyId: string): Promise<BroadcastTemplate[]>;
  getBroadcastTemplate(id: string): Promise<BroadcastTemplate | undefined>;
  createBroadcastTemplate(data: InsertBroadcastTemplate): Promise<BroadcastTemplate>;
  updateBroadcastTemplate(id: string, data: Partial<InsertBroadcastTemplate>): Promise<BroadcastTemplate | undefined>;
  deleteBroadcastTemplate(id: string): Promise<void>;
  createBroadcastMessage(data: InsertBroadcastMessage): Promise<BroadcastMessage>;
  getBroadcastMessages(companyId: string): Promise<BroadcastMessageWithDetails[]>;
  getBroadcastMessage(id: string): Promise<BroadcastMessageWithDetails | undefined>;
  getBroadcastDeliveries(broadcastMessageId: string): Promise<BroadcastDelivery[]>;

  getAllEmployees(companyId: string): Promise<Employee[]>;
  getActiveEmployees(companyId: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(data: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, data: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<void>;

  getEmployeeEmployments(employeeId: string): Promise<EmployeeEmployment[]>;
  getEmployeeEmployment(id: string): Promise<EmployeeEmployment | undefined>;
  createEmployeeEmployment(data: InsertEmployeeEmployment): Promise<EmployeeEmployment>;
  updateEmployeeEmployment(id: string, data: Partial<InsertEmployeeEmployment>): Promise<EmployeeEmployment | undefined>;
  deleteEmployeeEmployment(id: string): Promise<void>;

  getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  getEmployeeDocument(id: string): Promise<EmployeeDocument | undefined>;
  createEmployeeDocument(data: InsertEmployeeDocument): Promise<EmployeeDocument>;
  updateEmployeeDocument(id: string, data: Partial<InsertEmployeeDocument>): Promise<EmployeeDocument | undefined>;
  deleteEmployeeDocument(id: string): Promise<void>;

  getEmployeeLicences(employeeId: string): Promise<EmployeeLicence[]>;
  getEmployeeLicence(id: string): Promise<EmployeeLicence | undefined>;
  createEmployeeLicence(data: InsertEmployeeLicence): Promise<EmployeeLicence>;
  updateEmployeeLicence(id: string, data: Partial<InsertEmployeeLicence>): Promise<EmployeeLicence | undefined>;
  deleteEmployeeLicence(id: string): Promise<void>;
}
