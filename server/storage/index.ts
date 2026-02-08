import { companyMethods } from "./companies";
import { userMethods } from "./users";
import { dailyLogMethods } from "./daily-logs";
import { jobMethods } from "./jobs";
import { panelMethods } from "./panels";
import { productionMethods } from "./production";
import { panelTypeMethods } from "./panel-types";
import { logisticsMethods } from "./logistics";
import { reportMethods } from "./reports";
import { permissionMethods } from "./permissions";
import { configMethods } from "./config";
import { procurementMethods } from "./procurement";
import { taskMethods } from "./tasks";
import { documentMethods } from "./documents";
import { schedulingMethods } from "./scheduling";
import { broadcastMethods } from "./broadcast";

export type { IStorage } from "./types";
export type {
  WorkingDaysConfig,
  WeeklyJobReportWithDetails,
  EotClaimWithDetails,
  LoadReturnWithDetails,
  LoadListWithDetails,
  ProductionSlotWithDetails,
  ProductionSlotAdjustmentWithDetails,
  DraftingProgramWithDetails,
  PurchaseOrderWithDetails,
  ItemWithDetails,
  TaskWithDetails,
  TaskGroupWithTasks,
} from "./types";

export { db } from "../db";
export {
  sha256Hex,
  randomKey,
  getFactoryWorkDays,
  getCfmeuHolidaysInRange,
  isWorkingDay,
  addWorkingDays,
  subtractWorkingDays,
} from "./utils";

import type { IStorage } from "./types";

export class DatabaseStorage implements IStorage {
  getAllCompanies = companyMethods.getAllCompanies;
  getCompany = companyMethods.getCompany;
  getCompanyByCode = companyMethods.getCompanyByCode;
  createCompany = companyMethods.createCompany;
  updateCompany = companyMethods.updateCompany;
  deleteCompany = companyMethods.deleteCompany;

  getUser = userMethods.getUser;
  getUserByEmail = userMethods.getUserByEmail;
  createUser = userMethods.createUser;
  updateUser = userMethods.updateUser;
  deleteUser = userMethods.deleteUser;
  getAllUsers = userMethods.getAllUsers;
  validatePassword = userMethods.validatePassword;
  updateUserSettings = userMethods.updateUserSettings;
  getDepartment = userMethods.getDepartment;
  getDepartmentsByCompany = userMethods.getDepartmentsByCompany;
  createDepartment = userMethods.createDepartment;
  updateDepartment = userMethods.updateDepartment;
  deleteDepartment = userMethods.deleteDepartment;
  getDevice = userMethods.getDevice;
  getDeviceByApiKey = userMethods.getDeviceByApiKey;
  createDevice = userMethods.createDevice;
  updateDevice = userMethods.updateDevice;
  deleteDevice = userMethods.deleteDevice;
  getAllDevices = userMethods.getAllDevices;
  createMappingRule = userMethods.createMappingRule;
  deleteMappingRule = userMethods.deleteMappingRule;
  getMappingRule = userMethods.getMappingRule;
  getMappingRules = userMethods.getMappingRules;

  getDailyLog = dailyLogMethods.getDailyLog;
  getDailyLogsByUser = dailyLogMethods.getDailyLogsByUser;
  getSubmittedDailyLogs = dailyLogMethods.getSubmittedDailyLogs;
  getDailyLogByUserAndDay = dailyLogMethods.getDailyLogByUserAndDay;
  createDailyLog = dailyLogMethods.createDailyLog;
  upsertDailyLog = dailyLogMethods.upsertDailyLog;
  updateDailyLogStatus = dailyLogMethods.updateDailyLogStatus;
  getLogRow = dailyLogMethods.getLogRow;
  upsertLogRow = dailyLogMethods.upsertLogRow;
  updateLogRow = dailyLogMethods.updateLogRow;
  deleteLogRow = dailyLogMethods.deleteLogRow;
  deleteDailyLog = dailyLogMethods.deleteDailyLog;
  createApprovalEvent = dailyLogMethods.createApprovalEvent;
  getDailyLogsInRange = dailyLogMethods.getDailyLogsInRange;
  getDailyLogsWithRowsInRange = dailyLogMethods.getDailyLogsWithRowsInRange;

  getJob = jobMethods.getJob;
  getJobByNumber = jobMethods.getJobByNumber;
  createJob = jobMethods.createJob;
  updateJob = jobMethods.updateJob;
  deleteJob = jobMethods.deleteJob;
  getAllJobs = jobMethods.getAllJobs;
  importJobs = jobMethods.importJobs;

  getPanelRegisterItem = panelMethods.getPanelRegisterItem;
  getPanelsByJob = panelMethods.getPanelsByJob;
  getPanelsByJobAndLevel = panelMethods.getPanelsByJobAndLevel;
  createPanelRegisterItem = panelMethods.createPanelRegisterItem;
  updatePanelRegisterItem = panelMethods.updatePanelRegisterItem;
  deletePanelRegisterItem = panelMethods.deletePanelRegisterItem;
  getAllPanelRegisterItems = panelMethods.getAllPanelRegisterItems;
  getPaginatedPanelRegisterItems = panelMethods.getPaginatedPanelRegisterItems;
  importPanelRegister = panelMethods.importPanelRegister;
  updatePanelActualHours = panelMethods.updatePanelActualHours;
  getPanelCountsBySource = panelMethods.getPanelCountsBySource;
  panelsWithSourceHaveRecords = panelMethods.panelsWithSourceHaveRecords;
  deletePanelsBySource = panelMethods.deletePanelsBySource;
  deletePanelsByJobAndSource = panelMethods.deletePanelsByJobAndSource;
  getExistingPanelSourceIds = panelMethods.getExistingPanelSourceIds;
  importEstimatePanels = panelMethods.importEstimatePanels;
  getPanelById = panelMethods.getPanelById;
  approvePanelForProduction = panelMethods.approvePanelForProduction;
  revokePanelProductionApproval = panelMethods.revokePanelProductionApproval;
  getPanelsReadyForLoading = panelMethods.getPanelsReadyForLoading;
  getPanelsApprovedForProduction = panelMethods.getPanelsApprovedForProduction;

  getProductionEntry = productionMethods.getProductionEntry;
  getProductionEntriesByDate = productionMethods.getProductionEntriesByDate;
  getProductionEntriesByDateAndFactory = productionMethods.getProductionEntriesByDateAndFactory;
  getProductionEntriesByDateAndFactoryId = productionMethods.getProductionEntriesByDateAndFactoryId;
  getProductionEntriesInRange = productionMethods.getProductionEntriesInRange;
  createProductionEntry = productionMethods.createProductionEntry;
  updateProductionEntry = productionMethods.updateProductionEntry;
  deleteProductionEntry = productionMethods.deleteProductionEntry;
  getProductionEntryByPanelId = productionMethods.getProductionEntryByPanelId;
  getAllProductionEntries = productionMethods.getAllProductionEntries;
  getProductionSummaryByDate = productionMethods.getProductionSummaryByDate;
  getProductionDays = productionMethods.getProductionDays;
  getProductionDay = productionMethods.getProductionDay;
  getProductionDayByFactoryId = productionMethods.getProductionDayByFactoryId;
  createProductionDay = productionMethods.createProductionDay;
  deleteProductionDay = productionMethods.deleteProductionDay;
  deleteProductionDayByDateAndFactory = productionMethods.deleteProductionDayByDateAndFactory;
  deleteProductionDayByDateAndFactoryId = productionMethods.deleteProductionDayByDateAndFactoryId;
  getProductionSlots = productionMethods.getProductionSlots;
  getProductionSlot = productionMethods.getProductionSlot;
  checkPanelLevelCoverage = productionMethods.checkPanelLevelCoverage;
  generateProductionSlotsForJob = productionMethods.generateProductionSlotsForJob;
  adjustProductionSlot = productionMethods.adjustProductionSlot;
  bookProductionSlot = productionMethods.bookProductionSlot;
  completeProductionSlot = productionMethods.completeProductionSlot;
  getProductionSlotAdjustments = productionMethods.getProductionSlotAdjustments;
  getJobsWithoutProductionSlots = productionMethods.getJobsWithoutProductionSlots;
  deleteProductionSlot = productionMethods.deleteProductionSlot;
  checkAndCompleteSlotByPanelCompletion = productionMethods.checkAndCompleteSlotByPanelCompletion;
  getJobLevelCycleTimes = productionMethods.getJobLevelCycleTimes;
  saveJobLevelCycleTimes = productionMethods.saveJobLevelCycleTimes;
  getJobLevelCycleTime = productionMethods.getJobLevelCycleTime;

  getPanelType = panelTypeMethods.getPanelType;
  getPanelTypeByCode = panelTypeMethods.getPanelTypeByCode;
  createPanelType = panelTypeMethods.createPanelType;
  updatePanelType = panelTypeMethods.updatePanelType;
  deletePanelType = panelTypeMethods.deletePanelType;
  getAllPanelTypes = panelTypeMethods.getAllPanelTypes;
  getJobPanelRate = panelTypeMethods.getJobPanelRate;
  getJobPanelRates = panelTypeMethods.getJobPanelRates;
  upsertJobPanelRate = panelTypeMethods.upsertJobPanelRate;
  deleteJobPanelRate = panelTypeMethods.deleteJobPanelRate;
  getEffectiveRates = panelTypeMethods.getEffectiveRates;
  getWorkType = panelTypeMethods.getWorkType;
  getWorkTypeByCode = panelTypeMethods.getWorkTypeByCode;
  createWorkType = panelTypeMethods.createWorkType;
  updateWorkType = panelTypeMethods.updateWorkType;
  deleteWorkType = panelTypeMethods.deleteWorkType;
  getAllWorkTypes = panelTypeMethods.getAllWorkTypes;
  getActiveWorkTypes = panelTypeMethods.getActiveWorkTypes;
  getCostComponentsByPanelType = panelTypeMethods.getCostComponentsByPanelType;
  createCostComponent = panelTypeMethods.createCostComponent;
  updateCostComponent = panelTypeMethods.updateCostComponent;
  deleteCostComponent = panelTypeMethods.deleteCostComponent;
  replaceCostComponents = panelTypeMethods.replaceCostComponents;
  getJobCostOverrides = panelTypeMethods.getJobCostOverrides;
  getJobCostOverridesByPanelType = panelTypeMethods.getJobCostOverridesByPanelType;
  createJobCostOverride = panelTypeMethods.createJobCostOverride;
  updateJobCostOverride = panelTypeMethods.updateJobCostOverride;
  deleteJobCostOverride = panelTypeMethods.deleteJobCostOverride;
  initializeJobCostOverrides = panelTypeMethods.initializeJobCostOverrides;

  getAllTrailerTypes = logisticsMethods.getAllTrailerTypes;
  getActiveTrailerTypes = logisticsMethods.getActiveTrailerTypes;
  getTrailerType = logisticsMethods.getTrailerType;
  createTrailerType = logisticsMethods.createTrailerType;
  updateTrailerType = logisticsMethods.updateTrailerType;
  deleteTrailerType = logisticsMethods.deleteTrailerType;
  getAllLoadLists = logisticsMethods.getAllLoadLists;
  getLoadList = logisticsMethods.getLoadList;
  createLoadList = logisticsMethods.createLoadList;
  updateLoadList = logisticsMethods.updateLoadList;
  deleteLoadList = logisticsMethods.deleteLoadList;
  addPanelToLoadList = logisticsMethods.addPanelToLoadList;
  removePanelFromLoadList = logisticsMethods.removePanelFromLoadList;
  getLoadListPanels = logisticsMethods.getLoadListPanels;
  getDeliveryRecord = logisticsMethods.getDeliveryRecord;
  getDeliveryRecordById = logisticsMethods.getDeliveryRecordById;
  createDeliveryRecord = logisticsMethods.createDeliveryRecord;
  updateDeliveryRecord = logisticsMethods.updateDeliveryRecord;
  getLoadReturn = logisticsMethods.getLoadReturn;
  createLoadReturn = logisticsMethods.createLoadReturn;

  getDashboardStats = reportMethods.getDashboardStats;
  getReports = reportMethods.getReports;
  getWeeklyWageReports = reportMethods.getWeeklyWageReports;
  getWeeklyWageReport = reportMethods.getWeeklyWageReport;
  getWeeklyWageReportByWeek = reportMethods.getWeeklyWageReportByWeek;
  getWeeklyWageReportByWeekAndFactoryId = reportMethods.getWeeklyWageReportByWeekAndFactoryId;
  createWeeklyWageReport = reportMethods.createWeeklyWageReport;
  updateWeeklyWageReport = reportMethods.updateWeeklyWageReport;
  deleteWeeklyWageReport = reportMethods.deleteWeeklyWageReport;
  getWeeklyJobReports = reportMethods.getWeeklyJobReports;
  getWeeklyJobReport = reportMethods.getWeeklyJobReport;
  getWeeklyJobReportsByStatus = reportMethods.getWeeklyJobReportsByStatus;
  createWeeklyJobReport = reportMethods.createWeeklyJobReport;
  updateWeeklyJobReport = reportMethods.updateWeeklyJobReport;
  submitWeeklyJobReport = reportMethods.submitWeeklyJobReport;
  approveWeeklyJobReport = reportMethods.approveWeeklyJobReport;
  rejectWeeklyJobReport = reportMethods.rejectWeeklyJobReport;
  deleteWeeklyJobReport = reportMethods.deleteWeeklyJobReport;
  getJobsForProjectManager = reportMethods.getJobsForProjectManager;
  getApprovedWeeklyJobReports = reportMethods.getApprovedWeeklyJobReports;
  getEotClaims = reportMethods.getEotClaims;
  getEotClaim = reportMethods.getEotClaim;
  getEotClaimsByJob = reportMethods.getEotClaimsByJob;
  createEotClaim = reportMethods.createEotClaim;
  updateEotClaim = reportMethods.updateEotClaim;
  submitEotClaim = reportMethods.submitEotClaim;
  approveEotClaim = reportMethods.approveEotClaim;
  rejectEotClaim = reportMethods.rejectEotClaim;
  deleteEotClaim = reportMethods.deleteEotClaim;
  getNextEotClaimNumber = reportMethods.getNextEotClaimNumber;

  getUserPermissions = permissionMethods.getUserPermissions;
  getUserPermission = permissionMethods.getUserPermission;
  setUserPermission = permissionMethods.setUserPermission;
  deleteUserPermission = permissionMethods.deleteUserPermission;
  initializeUserPermissions = permissionMethods.initializeUserPermissions;
  getAllUserPermissionsForAdmin = permissionMethods.getAllUserPermissionsForAdmin;

  getGlobalSettings = configMethods.getGlobalSettings;
  updateGlobalSettings = configMethods.updateGlobalSettings;
  getAllZones = configMethods.getAllZones;
  getZone = configMethods.getZone;
  getZoneByCode = configMethods.getZoneByCode;
  createZone = configMethods.createZone;
  updateZone = configMethods.updateZone;
  deleteZone = configMethods.deleteZone;

  getAllCustomers = procurementMethods.getAllCustomers;
  getActiveCustomers = procurementMethods.getActiveCustomers;
  getCustomer = procurementMethods.getCustomer;
  createCustomer = procurementMethods.createCustomer;
  updateCustomer = procurementMethods.updateCustomer;
  deleteCustomer = procurementMethods.deleteCustomer;
  getAllSuppliers = procurementMethods.getAllSuppliers;
  getActiveSuppliers = procurementMethods.getActiveSuppliers;
  getSupplier = procurementMethods.getSupplier;
  createSupplier = procurementMethods.createSupplier;
  updateSupplier = procurementMethods.updateSupplier;
  deleteSupplier = procurementMethods.deleteSupplier;
  getAllItemCategories = procurementMethods.getAllItemCategories;
  getActiveItemCategories = procurementMethods.getActiveItemCategories;
  getItemCategory = procurementMethods.getItemCategory;
  createItemCategory = procurementMethods.createItemCategory;
  updateItemCategory = procurementMethods.updateItemCategory;
  deleteItemCategory = procurementMethods.deleteItemCategory;
  getAllItems = procurementMethods.getAllItems;
  getActiveItems = procurementMethods.getActiveItems;
  getItem = procurementMethods.getItem;
  getItemsByCategory = procurementMethods.getItemsByCategory;
  getItemsBySupplier = procurementMethods.getItemsBySupplier;
  createItem = procurementMethods.createItem;
  updateItem = procurementMethods.updateItem;
  deleteItem = procurementMethods.deleteItem;
  bulkImportItems = procurementMethods.bulkImportItems;
  getAllPurchaseOrders = procurementMethods.getAllPurchaseOrders;
  getPurchaseOrdersByStatus = procurementMethods.getPurchaseOrdersByStatus;
  getPurchaseOrdersByUser = procurementMethods.getPurchaseOrdersByUser;
  getPurchaseOrder = procurementMethods.getPurchaseOrder;
  createPurchaseOrder = procurementMethods.createPurchaseOrder;
  updatePurchaseOrder = procurementMethods.updatePurchaseOrder;
  submitPurchaseOrder = procurementMethods.submitPurchaseOrder;
  approvePurchaseOrder = procurementMethods.approvePurchaseOrder;
  rejectPurchaseOrder = procurementMethods.rejectPurchaseOrder;
  deletePurchaseOrder = procurementMethods.deletePurchaseOrder;
  getNextPONumber = procurementMethods.getNextPONumber;
  getPurchaseOrderAttachments = procurementMethods.getPurchaseOrderAttachments;
  getPurchaseOrderAttachment = procurementMethods.getPurchaseOrderAttachment;
  createPurchaseOrderAttachment = procurementMethods.createPurchaseOrderAttachment;
  deletePurchaseOrderAttachment = procurementMethods.deletePurchaseOrderAttachment;

  getAllTaskGroups = taskMethods.getAllTaskGroups;
  getTaskGroup = taskMethods.getTaskGroup;
  createTaskGroup = taskMethods.createTaskGroup;
  updateTaskGroup = taskMethods.updateTaskGroup;
  deleteTaskGroup = taskMethods.deleteTaskGroup;
  reorderTaskGroups = taskMethods.reorderTaskGroups;
  getTask = taskMethods.getTask;
  createTask = taskMethods.createTask;
  updateTask = taskMethods.updateTask;
  deleteTask = taskMethods.deleteTask;
  reorderTasks = taskMethods.reorderTasks;
  moveTaskToGroup = taskMethods.moveTaskToGroup;
  getTaskAssignees = taskMethods.getTaskAssignees;
  setTaskAssignees = taskMethods.setTaskAssignees;
  getTaskUpdates = taskMethods.getTaskUpdates;
  getTaskUpdate = taskMethods.getTaskUpdate;
  createTaskUpdate = taskMethods.createTaskUpdate;
  deleteTaskUpdate = taskMethods.deleteTaskUpdate;
  getTaskFiles = taskMethods.getTaskFiles;
  getTaskFile = taskMethods.getTaskFile;
  createTaskFile = taskMethods.createTaskFile;
  deleteTaskFile = taskMethods.deleteTaskFile;
  getTaskNotifications = taskMethods.getTaskNotifications;
  getTaskNotificationById = taskMethods.getTaskNotificationById;
  getUnreadTaskNotificationCount = taskMethods.getUnreadTaskNotificationCount;
  markTaskNotificationRead = taskMethods.markTaskNotificationRead;
  markAllTaskNotificationsRead = taskMethods.markAllTaskNotificationsRead;
  createTaskNotificationsForAssignees = taskMethods.createTaskNotificationsForAssignees;

  getAllDocumentTypes = documentMethods.getAllDocumentTypes;
  getActiveDocumentTypes = documentMethods.getActiveDocumentTypes;
  getDocumentType = documentMethods.getDocumentType;
  createDocumentType = documentMethods.createDocumentType;
  updateDocumentType = documentMethods.updateDocumentType;
  deleteDocumentType = documentMethods.deleteDocumentType;
  getDocumentTypeStatuses = documentMethods.getDocumentTypeStatuses;
  createDocumentTypeStatus = documentMethods.createDocumentTypeStatus;
  updateDocumentTypeStatus = documentMethods.updateDocumentTypeStatus;
  deleteDocumentTypeStatus = documentMethods.deleteDocumentTypeStatus;
  getAllDocumentDisciplines = documentMethods.getAllDocumentDisciplines;
  getActiveDocumentDisciplines = documentMethods.getActiveDocumentDisciplines;
  getDocumentDiscipline = documentMethods.getDocumentDiscipline;
  createDocumentDiscipline = documentMethods.createDocumentDiscipline;
  updateDocumentDiscipline = documentMethods.updateDocumentDiscipline;
  deleteDocumentDiscipline = documentMethods.deleteDocumentDiscipline;
  getAllDocumentCategories = documentMethods.getAllDocumentCategories;
  getActiveDocumentCategories = documentMethods.getActiveDocumentCategories;
  getDocumentCategory = documentMethods.getDocumentCategory;
  createDocumentCategory = documentMethods.createDocumentCategory;
  updateDocumentCategory = documentMethods.updateDocumentCategory;
  deleteDocumentCategory = documentMethods.deleteDocumentCategory;
  getDocuments = documentMethods.getDocuments;
  getDocument = documentMethods.getDocument;
  getDocumentsByIds = documentMethods.getDocumentsByIds;
  createDocument = documentMethods.createDocument;
  updateDocument = documentMethods.updateDocument;
  deleteDocument = documentMethods.deleteDocument;
  getNextDocumentNumber = documentMethods.getNextDocumentNumber;
  getDocumentVersionHistory = documentMethods.getDocumentVersionHistory;
  createNewVersion = documentMethods.createNewVersion;
  getAllDocumentBundles = documentMethods.getAllDocumentBundles;
  getDocumentBundle = documentMethods.getDocumentBundle;
  getDocumentBundleByQr = documentMethods.getDocumentBundleByQr;
  createDocumentBundle = documentMethods.createDocumentBundle;
  updateDocumentBundle = documentMethods.updateDocumentBundle;
  deleteDocumentBundle = documentMethods.deleteDocumentBundle;
  addDocumentsToBundle = documentMethods.addDocumentsToBundle;
  removeDocumentFromBundle = documentMethods.removeDocumentFromBundle;
  logBundleAccess = documentMethods.logBundleAccess;
  getBundleAccessLogs = documentMethods.getBundleAccessLogs;

  getDraftingPrograms = schedulingMethods.getDraftingPrograms;
  getDraftingProgram = schedulingMethods.getDraftingProgram;
  getDraftingProgramByPanelId = schedulingMethods.getDraftingProgramByPanelId;
  createDraftingProgram = schedulingMethods.createDraftingProgram;
  updateDraftingProgram = schedulingMethods.updateDraftingProgram;
  deleteDraftingProgram = schedulingMethods.deleteDraftingProgram;
  deleteDraftingProgramByJob = schedulingMethods.deleteDraftingProgramByJob;
  generateDraftingProgramFromProductionSlots = schedulingMethods.generateDraftingProgramFromProductionSlots;
  assignDraftingResource = schedulingMethods.assignDraftingResource;
  getIfcPanelsForProcurement = schedulingMethods.getIfcPanelsForProcurement;
  createReoSchedule = schedulingMethods.createReoSchedule;
  getReoSchedule = schedulingMethods.getReoSchedule;
  getReoScheduleByPanel = schedulingMethods.getReoScheduleByPanel;
  getReoScheduleWithDetails = schedulingMethods.getReoScheduleWithDetails;
  updateReoSchedule = schedulingMethods.updateReoSchedule;
  getReoSchedulesByCompany = schedulingMethods.getReoSchedulesByCompany;
  createReoScheduleItem = schedulingMethods.createReoScheduleItem;
  createReoScheduleItemsBulk = schedulingMethods.createReoScheduleItemsBulk;
  getReoScheduleItems = schedulingMethods.getReoScheduleItems;
  updateReoScheduleItem = schedulingMethods.updateReoScheduleItem;
  deleteReoScheduleItem = schedulingMethods.deleteReoScheduleItem;
  updateReoScheduleItemsStatus = schedulingMethods.updateReoScheduleItemsStatus;
  linkReoScheduleItemsToPO = schedulingMethods.linkReoScheduleItemsToPO;

  getBroadcastTemplates = broadcastMethods.getBroadcastTemplates;
  getBroadcastTemplate = broadcastMethods.getBroadcastTemplate;
  createBroadcastTemplate = broadcastMethods.createBroadcastTemplate;
  updateBroadcastTemplate = broadcastMethods.updateBroadcastTemplate;
  deleteBroadcastTemplate = broadcastMethods.deleteBroadcastTemplate;
  createBroadcastMessage = broadcastMethods.createBroadcastMessage;
  getBroadcastMessages = broadcastMethods.getBroadcastMessages;
  getBroadcastMessage = broadcastMethods.getBroadcastMessage;
  getBroadcastDeliveries = broadcastMethods.getBroadcastDeliveries;
}

export const storage = new DatabaseStorage();
