// Repository exports - Phase 2 refactoring
// Note: Repositories are currently in migration - storage.ts remains the primary implementation
// These repositories can be used for new code, but the main storage.ts handles backward compatibility

export { userRepository, UserRepository, sha256Hex, randomKey } from "./user.repository";
export { settingsRepository, SettingsRepository } from "./settings.repository";
export { factoryRepository, FactoryRepository } from "./factory.repository";
export { jobRepository, JobRepository } from "./job.repository";
export { panelRepository, PanelRepository } from "./panel.repository";
export { productionRepository, ProductionRepository } from "./production.repository";
export { draftingRepository, DraftingRepository } from "./drafting.repository";
export { logisticsRepository, LogisticsRepository } from "./logistics.repository";
export { reportsRepository, ReportsRepository } from "./reports.repository";
export { procurementRepository, ProcurementRepository } from "./procurement.repository";
export { taskRepository, TaskRepository } from "./task.repository";

// Re-export types
export type { LoadListWithDetails } from "./logistics.repository";
export type { ProductionSlotWithDetails, ProductionSlotAdjustmentWithDetails } from "./production.repository";
export type { DraftingProgramWithDetails } from "./drafting.repository";
export type { WeeklyJobReportWithDetails } from "./reports.repository";
export type { ItemWithDetails, PurchaseOrderWithDetails } from "./procurement.repository";
export type { TaskWithDetails, TaskGroupWithTasks } from "./task.repository";
