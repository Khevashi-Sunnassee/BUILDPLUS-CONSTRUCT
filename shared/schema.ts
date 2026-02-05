import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, uniqueIndex, index, decimal, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["USER", "MANAGER", "ADMIN"]);
export const logStatusEnum = pgEnum("log_status", ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]);
export const disciplineEnum = pgEnum("discipline", ["DRAFTING"]);
export const jobStatusEnum = pgEnum("job_status", ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]);
export const panelStatusEnum = pgEnum("panel_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "PENDING"]);
export const loadListStatusEnum = pgEnum("load_list_status", ["PENDING", "COMPLETE"]);
export const permissionLevelEnum = pgEnum("permission_level", ["HIDDEN", "VIEW", "VIEW_AND_UPDATE"]);
export const weeklyReportStatusEnum = pgEnum("weekly_report_status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);
export const documentStatusEnum = pgEnum("document_status", ["DRAFT", "IFA", "IFC", "APPROVED"]);
export const productionSlotStatusEnum = pgEnum("production_slot_status", ["SCHEDULED", "PENDING_UPDATE", "BOOKED", "COMPLETED"]);
export const poStatusEnum = pgEnum("po_status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);
export const draftingProgramStatusEnum = pgEnum("drafting_program_status", ["NOT_SCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").default("USER").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  poApprover: boolean("po_approver").default(false),
  poApprovalLimit: decimal("po_approval_limit", { precision: 12, scale: 2 }),
  mondayStartTime: text("monday_start_time").default("08:00"),
  mondayHours: decimal("monday_hours", { precision: 4, scale: 2 }).default("8"),
  tuesdayStartTime: text("tuesday_start_time").default("08:00"),
  tuesdayHours: decimal("tuesday_hours", { precision: 4, scale: 2 }).default("8"),
  wednesdayStartTime: text("wednesday_start_time").default("08:00"),
  wednesdayHours: decimal("wednesday_hours", { precision: 4, scale: 2 }).default("8"),
  thursdayStartTime: text("thursday_start_time").default("08:00"),
  thursdayHours: decimal("thursday_hours", { precision: 4, scale: 2 }).default("8"),
  fridayStartTime: text("friday_start_time").default("08:00"),
  fridayHours: decimal("friday_hours", { precision: 4, scale: 2 }).default("8"),
  saturdayStartTime: text("saturday_start_time").default("08:00"),
  saturdayHours: decimal("saturday_hours", { precision: 4, scale: 2 }).default("0"),
  sundayStartTime: text("sunday_start_time").default("08:00"),
  sundayHours: decimal("sunday_hours", { precision: 4, scale: 2 }).default("0"),
  selectedFactoryIds: text("selected_factory_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userPermissions = pgTable("user_permissions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  functionKey: text("function_key").notNull(),
  permissionLevel: permissionLevelEnum("permission_level").default("VIEW_AND_UPDATE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userFunctionIdx: uniqueIndex("user_permissions_user_function_idx").on(table.userId, table.functionKey),
  userIdIdx: index("user_permissions_user_id_idx").on(table.userId),
}));

export const FUNCTION_KEYS = [
  "daily_reports",
  "production_report",
  "logistics",
  "weekly_wages",
  "weekly_job_logs",
  "kpi_dashboard",
  "jobs",
  "panel_register",
  "purchase_orders",
  "tasks",
  "chat",
  "admin_users",
  "admin_devices",
  "admin_jobs",
  "admin_settings",
  "admin_panel_types",
  "admin_work_types",
  "admin_trailer_types",
  "admin_user_permissions",
  "admin_zones",
  "admin_suppliers",
  "admin_item_catalog",
  "admin_factories",
] as const;

export type FunctionKey = typeof FUNCTION_KEYS[number];

export const devices = pgTable("devices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  deviceName: text("device_name").notNull(),
  os: text("os").notNull(),
  agentVersion: text("agent_version"),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cfmeuCalendarEnum = pgEnum("cfmeu_calendar", ["NONE", "CFMEU_QLD", "CFMEU_VIC"]);

export const globalSettings = pgTable("global_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tz: text("tz").default("Australia/Melbourne").notNull(),
  captureIntervalS: integer("capture_interval_s").default(300).notNull(),
  idleThresholdS: integer("idle_threshold_s").default(300).notNull(),
  trackedApps: text("tracked_apps").default("revit,acad").notNull(),
  requireAddins: boolean("require_addins").default(true).notNull(),
  logoBase64: text("logo_base64"),
  companyName: text("company_name").default("LTE Precast Concrete Structures"),
  weekStartDay: integer("week_start_day").default(1).notNull(),
  productionWindowDays: integer("production_window_days").default(10).notNull(),
  ifcDaysInAdvance: integer("ifc_days_in_advance").default(14).notNull(),
  daysToAchieveIfc: integer("days_to_achieve_ifc").default(21).notNull(),
  productionDaysInAdvance: integer("production_days_in_advance").default(10).notNull(),
  procurementDaysInAdvance: integer("procurement_days_in_advance").default(7).notNull(),
  procurementTimeDays: integer("procurement_time_days").default(14).notNull(),
  productionWorkDays: json("production_work_days").$type<boolean[]>().default([false, true, true, true, true, true, false]),
  draftingWorkDays: json("drafting_work_days").$type<boolean[]>().default([false, true, true, true, true, true, false]),
  cfmeuCalendar: cfmeuCalendarEnum("cfmeu_calendar").default("NONE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const australianStateEnum = pgEnum("australian_state", ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

export const cfmeuCalendarTypeEnum = pgEnum("cfmeu_calendar_type", ["VIC_ONSITE", "VIC_OFFSITE", "QLD"]);
export const cfmeuHolidayTypeEnum = pgEnum("cfmeu_holiday_type", ["RDO", "PUBLIC_HOLIDAY", "OTHER"]);

export const cfmeuHolidays = pgTable("cfmeu_holidays", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  calendarType: cfmeuCalendarTypeEnum("calendar_type").notNull(),
  date: timestamp("date").notNull(),
  name: text("name").notNull(),
  holidayType: cfmeuHolidayTypeEnum("holiday_type").default("RDO").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  calendarDateIdx: uniqueIndex("cfmeu_holidays_calendar_date_idx").on(table.calendarType, table.date),
  yearIdx: index("cfmeu_holidays_year_idx").on(table.year),
}));

export const factories = pgTable("factories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  state: australianStateEnum("state").default("VIC").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  cfmeuCalendar: cfmeuCalendarTypeEnum("cfmeu_calendar"),
  inheritWorkDays: boolean("inherit_work_days").default(true).notNull(),
  workDays: json("work_days").$type<boolean[]>().default([false, true, true, true, true, true, false]),
  color: text("color").default("#3B82F6"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("factories_code_idx").on(table.code),
  activeIdx: index("factories_active_idx").on(table.isActive),
}));

export const productionBeds = pgTable("production_beds", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  factoryId: varchar("factory_id", { length: 36 }).notNull().references(() => factories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lengthMm: integer("length_mm").notNull(),
  widthMm: integer("width_mm").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  factoryIdx: index("production_beds_factory_idx").on(table.factoryId),
  activeIdx: index("production_beds_active_idx").on(table.isActive),
}));

export const zones = pgTable("zones", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("zones_code_idx").on(table.code),
}));

export const insertZoneSchema = createInsertSchema(zones).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zones.$inferSelect;

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text("job_number").notNull().unique(),
  name: text("name").notNull(),
  code: text("code"),
  client: text("client"),
  address: text("address"),
  city: text("city"),
  state: australianStateEnum("state"),
  siteContact: text("site_contact"),
  siteContactPhone: text("site_contact_phone"),
  description: text("description"),
  craneCapacity: text("crane_capacity"),
  numberOfBuildings: integer("number_of_buildings"),
  levels: text("levels"), // comma-separated list of level names (e.g., "Ground,L1,L2,L3,Roof")
  lowestLevel: text("lowest_level"), // e.g., "Ground", "Basement", "L1"
  highestLevel: text("highest_level"), // e.g., "L5", "Roof"
  productionStartDate: timestamp("production_start_date"),
  expectedCycleTimePerFloor: integer("expected_cycle_time_per_floor"), // days per floor for production scheduling
  daysInAdvance: integer("days_in_advance").default(7), // IFC days before production (days before production when drawings need to reach IFC stage)
  daysToAchieveIfc: integer("days_to_achieve_ifc"), // days to complete drafting work
  productionWindowDays: integer("production_window_days"), // days before due date when production can start
  productionDaysInAdvance: integer("production_days_in_advance"), // days before site needs panels to cast
  procurementDaysInAdvance: integer("procurement_days_in_advance"), // days before production window start for procurement
  procurementTimeDays: integer("procurement_time_days"), // time required for procurement
  projectManagerId: varchar("project_manager_id", { length: 36 }).references(() => users.id),
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id), // factory servicing this job for production
  productionSlotColor: text("production_slot_color"), // hex color for production slots display
  status: jobStatusEnum("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobNumberIdx: index("jobs_job_number_idx").on(table.jobNumber),
  statusIdx: index("jobs_status_idx").on(table.status),
  codeIdx: index("jobs_code_idx").on(table.code),
  projectManagerIdx: index("jobs_project_manager_idx").on(table.projectManagerId),
  factoryIdx: index("jobs_factory_idx").on(table.factoryId),
}));

export const jobLevelCycleTimes = pgTable("job_level_cycle_times", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  buildingNumber: integer("building_number").notNull().default(1),
  level: text("level").notNull(),
  levelOrder: real("level_order").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("job_level_cycle_times_job_id_idx").on(table.jobId),
  uniqueJobBuildingLevel: index("job_level_cycle_times_unique_idx").on(table.jobId, table.buildingNumber, table.level),
}));

export const productionSlots = pgTable("production_slots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  buildingNumber: integer("building_number").default(1),
  level: text("level").notNull(),
  levelOrder: real("level_order").notNull(),
  panelCount: integer("panel_count").default(0),
  productionSlotDate: timestamp("production_slot_date").notNull(),
  status: productionSlotStatusEnum("status").default("SCHEDULED").notNull(),
  dateLastReportedOnsite: timestamp("date_last_reported_onsite"),
  isBooked: boolean("is_booked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("production_slots_job_id_idx").on(table.jobId),
  statusIdx: index("production_slots_status_idx").on(table.status),
  dateIdx: index("production_slots_date_idx").on(table.productionSlotDate),
}));

export const productionSlotAdjustments = pgTable("production_slot_adjustments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productionSlotId: varchar("production_slot_id", { length: 36 }).notNull().references(() => productionSlots.id),
  previousDate: timestamp("previous_date").notNull(),
  newDate: timestamp("new_date").notNull(),
  reason: text("reason").notNull(),
  changedById: varchar("changed_by_id", { length: 36 }).notNull().references(() => users.id),
  clientConfirmed: boolean("client_confirmed").default(false),
  cascadedToOtherSlots: boolean("cascaded_to_other_slots").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slotIdIdx: index("production_slot_adjustments_slot_id_idx").on(table.productionSlotId),
}));

export const draftingProgram = pgTable("drafting_program", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  productionSlotId: varchar("production_slot_id", { length: 36 }).references(() => productionSlots.id),
  level: text("level").notNull(),
  productionDate: timestamp("production_date"),
  drawingDueDate: timestamp("drawing_due_date"),
  draftingWindowStart: timestamp("drafting_window_start"),
  proposedStartDate: timestamp("proposed_start_date"),
  assignedToId: varchar("assigned_to_id", { length: 36 }).references(() => users.id),
  status: draftingProgramStatusEnum("status").default("NOT_SCHEDULED").notNull(),
  priority: integer("priority").default(0),
  estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }),
  actualHours: decimal("actual_hours", { precision: 6, scale: 2 }),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  panelIdIdx: index("drafting_program_panel_id_idx").on(table.panelId),
  jobIdIdx: index("drafting_program_job_id_idx").on(table.jobId),
  slotIdIdx: index("drafting_program_slot_id_idx").on(table.productionSlotId),
  assignedToIdx: index("drafting_program_assigned_to_idx").on(table.assignedToId),
  statusIdx: index("drafting_program_status_idx").on(table.status),
  dueDateIdx: index("drafting_program_due_date_idx").on(table.drawingDueDate),
}));

export const workTypes = pgTable("work_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("work_types_code_idx").on(table.code),
  sortOrderIdx: index("work_types_sort_order_idx").on(table.sortOrder),
}));

export const panelRegister = pgTable("panel_register", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  panelMark: text("panel_mark").notNull(),
  panelType: text("panel_type").default("WALL").notNull(),
  description: text("description"),
  drawingCode: text("drawing_code"),
  sheetNumber: text("sheet_number"),
  building: text("building"),
  zone: text("zone"),
  level: text("level"),
  structuralElevation: text("structural_elevation"),
  reckliDetail: text("reckli_detail"),
  qty: integer("qty").default(1).notNull(),
  workTypeId: integer("work_type_id").default(1).references(() => workTypes.id),
  takeoffCategory: text("takeoff_category"),
  concreteStrengthMpa: text("concrete_strength_mpa"),
  // Traceability fields for imports
  sourceFileName: text("source_file_name"),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
  panelSourceId: text("panel_source_id"),
  source: integer("source").default(1).notNull(), // 1=Manual, 2=Excel Template, 3=Estimate
  status: panelStatusEnum("status").default("NOT_STARTED").notNull(),
  documentStatus: documentStatusEnum("document_status").default("DRAFT").notNull(),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours").default(0),
  notes: text("notes"),
  // Production approval fields
  loadWidth: text("load_width"),
  loadHeight: text("load_height"),
  panelThickness: text("panel_thickness"),
  panelVolume: text("panel_volume"),
  panelMass: text("panel_mass"),
  panelArea: text("panel_area"),
  day28Fc: text("day_28_fc"),
  liftFcm: text("lift_fcm"),
  rotationalLifters: text("rotational_lifters"),
  primaryLifters: text("primary_lifters"),
  productionPdfUrl: text("production_pdf_url"),
  approvedForProduction: boolean("approved_for_production").default(false).notNull(),
  approvedAt: timestamp("approved_at"),
  approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("panel_register_job_id_idx").on(table.jobId),
  panelMarkIdx: index("panel_register_panel_mark_idx").on(table.panelMark),
  panelTypeIdx: index("panel_register_panel_type_idx").on(table.panelType),
  statusIdx: index("panel_register_status_idx").on(table.status),
  jobPanelIdx: uniqueIndex("panel_register_job_panel_idx").on(table.jobId, table.panelMark),
  approvedForProductionIdx: index("panel_register_approved_for_production_idx").on(table.approvedForProduction),
}));

export const mappingRules = pgTable("mapping_rules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  pathContains: text("path_contains").notNull(),
  priority: integer("priority").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  priorityIdx: index("mapping_rules_priority_idx").on(table.priority),
  jobIdIdx: index("mapping_rules_job_id_idx").on(table.jobId),
}));

export const dailyLogs = pgTable("daily_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  logDay: text("log_day").notNull(),
  tz: text("tz").default("Australia/Melbourne").notNull(),
  discipline: disciplineEnum("discipline").default("DRAFTING").notNull(),
  factory: text("factory").default("QLD").notNull(), // Deprecated - use factoryId
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  status: logStatusEnum("status").default("PENDING").notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 36 }),
  managerComment: text("manager_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userLogDayDisciplineFactoryIdx: uniqueIndex("user_log_day_discipline_factory_idx").on(table.userId, table.logDay, table.discipline, table.factory),
  logDayIdx: index("daily_logs_log_day_idx").on(table.logDay),
  factoryIdx: index("daily_logs_factory_idx").on(table.factory),
}));

export const logRows = pgTable("log_rows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dailyLogId: varchar("daily_log_id", { length: 36 }).notNull().references(() => dailyLogs.id),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  panelRegisterId: varchar("panel_register_id", { length: 36 }).references(() => panelRegister.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  durationMin: integer("duration_min").notNull(),
  idleMin: integer("idle_min").notNull(),
  source: text("source").notNull(),
  sourceEventId: text("source_event_id").notNull().unique(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
  tz: text("tz").default("Australia/Melbourne").notNull(),
  app: text("app").notNull(),
  filePath: text("file_path"),
  fileName: text("file_name"),
  revitViewName: text("revit_view_name"),
  revitSheetNumber: text("revit_sheet_number"),
  revitSheetName: text("revit_sheet_name"),
  acadLayoutName: text("acad_layout_name"),
  rawPanelMark: text("raw_panel_mark"),
  rawDrawingCode: text("raw_drawing_code"),
  panelMark: text("panel_mark"),
  drawingCode: text("drawing_code"),
  notes: text("notes"),
  isUserEdited: boolean("is_user_edited").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  dailyLogIdIdx: index("log_rows_daily_log_id_idx").on(table.dailyLogId),
  jobIdIdx: index("log_rows_job_id_idx").on(table.jobId),
  panelRegisterIdIdx: index("log_rows_panel_register_id_idx").on(table.panelRegisterId),
  startAtIdx: index("log_rows_start_at_idx").on(table.startAt),
  appIdx: index("log_rows_app_idx").on(table.app),
  fileNameIdx: index("log_rows_file_name_idx").on(table.fileName),
}));

export const approvalEvents = pgTable("approval_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dailyLogId: varchar("daily_log_id", { length: 36 }).notNull().references(() => dailyLogs.id),
  action: text("action").notNull(),
  actorId: varchar("actor_id", { length: 36 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  dailyLogIdIdx: index("approval_events_daily_log_id_idx").on(table.dailyLogId),
}));

export const auditEvents = pgTable("audit_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  eventType: text("event_type").notNull(),
  metaJson: text("meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventTypeIdx: index("audit_events_event_type_idx").on(table.eventType),
}));

export const panelTypes = pgTable("panel_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  labourCostPerM2: text("labour_cost_per_m2"),
  labourCostPerM3: text("labour_cost_per_m3"),
  supplyCostPerM2: text("supply_cost_per_m2"),
  supplyCostPerM3: text("supply_cost_per_m3"),
  installCostPerM2: text("install_cost_per_m2"),
  installCostPerM3: text("install_cost_per_m3"),
  totalRatePerM2: text("total_rate_per_m2"),
  totalRatePerM3: text("total_rate_per_m3"),
  sellRatePerM2: text("sell_rate_per_m2"),
  sellRatePerM3: text("sell_rate_per_m3"),
  expectedWeightPerM3: text("expected_weight_per_m3").default("2500"),
  color: text("color"), // hex color for panel type display
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("panel_types_code_idx").on(table.code),
}));

export const jobPanelRates = pgTable("job_panel_rates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  panelTypeId: varchar("panel_type_id", { length: 36 }).notNull().references(() => panelTypes.id),
  labourCostPerM2: text("labour_cost_per_m2"),
  labourCostPerM3: text("labour_cost_per_m3"),
  supplyCostPerM2: text("supply_cost_per_m2"),
  supplyCostPerM3: text("supply_cost_per_m3"),
  totalRatePerM2: text("total_rate_per_m2"),
  totalRatePerM3: text("total_rate_per_m3"),
  sellRatePerM2: text("sell_rate_per_m2"),
  sellRatePerM3: text("sell_rate_per_m3"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobPanelTypeIdx: uniqueIndex("job_panel_rates_job_panel_type_idx").on(table.jobId, table.panelTypeId),
}));

export const productionEntries = pgTable("production_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  productionDate: text("production_date").notNull(),
  factory: text("factory").default("QLD").notNull(), // Deprecated - use factoryId
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  status: text("status").default("PENDING").notNull(), // PENDING = scheduled, COMPLETED = produced
  bayNumber: text("bay_number"), // Bay number where the panel was cast
  volumeM3: text("volume_m3"),
  areaM2: text("area_m2"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  panelIdIdx: index("production_entries_panel_id_idx").on(table.panelId),
  jobIdIdx: index("production_entries_job_id_idx").on(table.jobId),
  userIdIdx: index("production_entries_user_id_idx").on(table.userId),
  productionDateIdx: index("production_entries_production_date_idx").on(table.productionDate),
  factoryIdx: index("production_entries_factory_idx").on(table.factory),
  statusIdx: index("production_entries_status_idx").on(table.status),
}));

export const productionDays = pgTable("production_days", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  productionDate: text("production_date").notNull(),
  factory: text("factory").notNull(), // Deprecated - use factoryId
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  notes: text("notes"),
  createdById: varchar("created_by_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  dateFactoryIdx: uniqueIndex("production_days_date_factory_idx").on(table.productionDate, table.factory),
  factoryIdx: index("production_days_factory_idx").on(table.factory),
  dateIdx: index("production_days_date_idx").on(table.productionDate),
}));

export const panelTypeCostComponents = pgTable("panel_type_cost_components", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  panelTypeId: varchar("panel_type_id", { length: 36 }).notNull().references(() => panelTypes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  percentageOfRevenue: text("percentage_of_revenue").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  panelTypeIdIdx: index("cost_components_panel_type_id_idx").on(table.panelTypeId),
  panelTypeNameIdx: uniqueIndex("cost_components_panel_type_name_idx").on(table.panelTypeId, table.name),
}));

export const jobCostOverrides = pgTable("job_cost_overrides", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  panelTypeId: varchar("panel_type_id", { length: 36 }).notNull().references(() => panelTypes.id, { onDelete: "cascade" }),
  componentName: text("component_name").notNull(),
  defaultPercentage: text("default_percentage").notNull(),
  revisedPercentage: text("revised_percentage"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("job_cost_overrides_job_id_idx").on(table.jobId),
  panelTypeIdIdx: index("job_cost_overrides_panel_type_id_idx").on(table.panelTypeId),
  jobPanelTypeComponentIdx: uniqueIndex("job_cost_overrides_unique_idx").on(table.jobId, table.panelTypeId, table.componentName),
}));

// Logistics tables
export const trailerTypes = pgTable("trailer_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const loadLists = pgTable("load_lists", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  loadNumber: text("load_number").notNull(),
  loadDate: text("load_date").notNull(),
  loadTime: text("load_time").notNull(),
  trailerTypeId: varchar("trailer_type_id", { length: 36 }).references(() => trailerTypes.id),
  factory: text("factory").default("QLD").notNull(), // Deprecated - use factoryId
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  uhf: text("uhf"),
  status: loadListStatusEnum("status").default("PENDING").notNull(),
  notes: text("notes"),
  createdById: varchar("created_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("load_lists_job_id_idx").on(table.jobId),
  loadDateIdx: index("load_lists_load_date_idx").on(table.loadDate),
  statusIdx: index("load_lists_status_idx").on(table.status),
  factoryIdx: index("load_lists_factory_idx").on(table.factory),
}));

export const loadListPanels = pgTable("load_list_panels", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  loadListId: varchar("load_list_id", { length: 36 }).notNull().references(() => loadLists.id, { onDelete: "cascade" }),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  sequence: integer("sequence").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  loadListIdIdx: index("load_list_panels_load_list_id_idx").on(table.loadListId),
  panelIdIdx: index("load_list_panels_panel_id_idx").on(table.panelId),
  loadListPanelIdx: uniqueIndex("load_list_panels_unique_idx").on(table.loadListId, table.panelId),
}));

export const deliveryRecords = pgTable("delivery_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  loadListId: varchar("load_list_id", { length: 36 }).notNull().references(() => loadLists.id, { onDelete: "cascade" }).unique(),
  docketNumber: text("docket_number"),
  loadDocumentNumber: text("load_document_number"),
  truckRego: text("truck_rego"),
  trailerRego: text("trailer_rego"),
  deliveryDate: text("delivery_date"),
  preload: text("preload"),
  loadNumber: text("load_number"),
  numberPanels: integer("number_panels"),
  comment: text("comment"),
  startTime: text("start_time"),
  leaveDepotTime: text("leave_depot_time"),
  arriveLteTime: text("arrive_lte_time"),
  pickupLocation: text("pickup_location"),
  pickupArriveTime: text("pickup_arrive_time"),
  pickupLeaveTime: text("pickup_leave_time"),
  deliveryLocation: text("delivery_location"),
  arriveHoldingTime: text("arrive_holding_time"),
  leaveHoldingTime: text("leave_holding_time"),
  siteFirstLiftTime: text("site_first_lift_time"),
  siteLastLiftTime: text("site_last_lift_time"),
  returnDepotArriveTime: text("return_depot_arrive_time"),
  totalHours: text("total_hours"),
  enteredById: varchar("entered_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  loadListIdIdx: index("delivery_records_load_list_id_idx").on(table.loadListId),
  deliveryDateIdx: index("delivery_records_delivery_date_idx").on(table.deliveryDate),
}));

export const weeklyWageReports = pgTable("weekly_wage_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: text("week_start_date").notNull(),
  weekEndDate: text("week_end_date").notNull(),
  factory: text("factory").default("QLD").notNull(), // Deprecated - use factoryId
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  productionWages: text("production_wages"),
  officeWages: text("office_wages"),
  estimatingWages: text("estimating_wages"),
  onsiteWages: text("onsite_wages"),
  draftingWages: text("drafting_wages"),
  civilWages: text("civil_wages"),
  notes: text("notes"),
  createdById: varchar("created_by_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  weekFactoryIdx: uniqueIndex("weekly_wage_reports_week_factory_idx").on(table.weekStartDate, table.weekEndDate, table.factory),
  factoryIdx: index("weekly_wage_reports_factory_idx").on(table.factory),
  weekStartIdx: index("weekly_wage_reports_week_start_idx").on(table.weekStartDate),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMappingRuleSchema = createInsertSchema(mappingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobLevelCycleTimeSchema = createInsertSchema(jobLevelCycleTimes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkTypeSchema = createInsertSchema(workTypes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertPanelRegisterSchema = createInsertSchema(panelRegister).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLogRowSchema = createInsertSchema(logRows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  capturedAt: true,
});

export const insertApprovalEventSchema = createInsertSchema(approvalEvents).omit({
  id: true,
  createdAt: true,
});

export const insertGlobalSettingsSchema = createInsertSchema(globalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCfmeuHolidaySchema = createInsertSchema(cfmeuHolidays).omit({
  id: true,
  createdAt: true,
});

export const insertFactorySchema = createInsertSchema(factories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductionBedSchema = createInsertSchema(productionBeds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductionEntrySchema = createInsertSchema(productionEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductionDaySchema = createInsertSchema(productionDays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanelTypeSchema = createInsertSchema(panelTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanelTypeCostComponentSchema = createInsertSchema(panelTypeCostComponents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobCostOverrideSchema = createInsertSchema(jobCostOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobPanelRateSchema = createInsertSchema(jobPanelRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrailerTypeSchema = createInsertSchema(trailerTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoadListSchema = createInsertSchema(loadLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoadListPanelSchema = createInsertSchema(loadListPanels).omit({
  id: true,
  createdAt: true,
});

export const insertDeliveryRecordSchema = createInsertSchema(deliveryRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyWageReportSchema = createInsertSchema(weeklyWageReports).omit({
  id: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
});

// Weekly Job Reports - for project managers to report site progress and production schedule
export const weeklyJobReports = pgTable("weekly_job_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectManagerId: varchar("project_manager_id", { length: 36 }).notNull().references(() => users.id),
  reportDate: text("report_date").notNull(), // YYYY-MM-DD format
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD format
  weekEndDate: text("week_end_date").notNull(), // YYYY-MM-DD format
  status: weeklyReportStatusEnum("status").default("DRAFT").notNull(),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectManagerIdx: index("weekly_job_reports_pm_idx").on(table.projectManagerId),
  reportDateIdx: index("weekly_job_reports_date_idx").on(table.reportDate),
  statusIdx: index("weekly_job_reports_status_idx").on(table.status),
}));

// Weekly Job Report Schedule Items - levels required per job in 7/14/21/28 days
export const weeklyJobReportSchedules = pgTable("weekly_job_report_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id", { length: 36 }).notNull().references(() => weeklyJobReports.id, { onDelete: "cascade" }),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  levels7Days: text("levels_7_days"), // comma-separated levels required in 7 days
  levels14Days: text("levels_14_days"), // comma-separated levels required in 14 days
  levels21Days: text("levels_21_days"), // comma-separated levels required in 21 days
  levels28Days: text("levels_28_days"), // comma-separated levels required in 28 days
  priority: integer("priority").default(0).notNull(), // production priority order
  siteProgress: text("site_progress"), // site progress notes
  currentLevelOnsite: text("current_level_onsite"), // current level being worked on at site
  scheduleStatus: text("schedule_status").default("ON_TRACK"), // ON_TRACK, RUNNING_BEHIND, ON_HOLD
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  reportIdx: index("weekly_job_report_schedules_report_idx").on(table.reportId),
  jobIdx: index("weekly_job_report_schedules_job_idx").on(table.jobId),
}));

export const insertWeeklyJobReportSchema = createInsertSchema(weeklyJobReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyJobReportScheduleSchema = createInsertSchema(weeklyJobReportSchedules).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const agentBlockSchema = z.object({
  sourceEventId: z.string().min(10),
  userEmail: z.string().email(),
  logDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startedAt: z.string(),
  endedAt: z.string(),
  durationMin: z.number().int().min(0).max(240),
  idleMin: z.number().int().min(0).max(240),
  app: z.enum(["revit", "acad"]),
  filePath: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  revit: z.object({
    viewName: z.string().optional().nullable(),
    sheetNumber: z.string().optional().nullable(),
    sheetName: z.string().optional().nullable(),
  }).optional().nullable(),
  acad: z.object({
    layoutName: z.string().optional().nullable(),
  }).optional().nullable(),
  rawPanelMark: z.string().optional().nullable(),
  rawDrawingCode: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
});

export const agentIngestSchema = z.object({
  deviceName: z.string().min(1),
  os: z.string().min(1),
  agentVersion: z.string().optional().nullable(),
  tz: z.string().default("Australia/Melbourne"),
  blocks: z.array(agentBlockSchema).min(1).max(200),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;
export type InsertMappingRule = z.infer<typeof insertMappingRuleSchema>;
export type MappingRule = typeof mappingRules.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type JobLevelCycleTime = typeof jobLevelCycleTimes.$inferSelect;
export type InsertJobLevelCycleTime = typeof jobLevelCycleTimes.$inferInsert;
export type InsertPanelRegister = z.infer<typeof insertPanelRegisterSchema>;
export type PanelRegister = typeof panelRegister.$inferSelect;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type InsertLogRow = z.infer<typeof insertLogRowSchema>;
export type LogRow = typeof logRows.$inferSelect;
export type InsertApprovalEvent = z.infer<typeof insertApprovalEventSchema>;
export type ApprovalEvent = typeof approvalEvents.$inferSelect;
export type InsertGlobalSettings = z.infer<typeof insertGlobalSettingsSchema>;
export type GlobalSettings = typeof globalSettings.$inferSelect;
export type InsertCfmeuHoliday = z.infer<typeof insertCfmeuHolidaySchema>;
export type CfmeuHoliday = typeof cfmeuHolidays.$inferSelect;
export type InsertFactory = z.infer<typeof insertFactorySchema>;
export type Factory = typeof factories.$inferSelect;
export type InsertProductionBed = z.infer<typeof insertProductionBedSchema>;
export type ProductionBed = typeof productionBeds.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertProductionEntry = z.infer<typeof insertProductionEntrySchema>;
export type ProductionEntry = typeof productionEntries.$inferSelect;
export type InsertProductionDay = z.infer<typeof insertProductionDaySchema>;
export type ProductionDay = typeof productionDays.$inferSelect;
export type InsertPanelType = z.infer<typeof insertPanelTypeSchema>;
export type PanelTypeConfig = typeof panelTypes.$inferSelect;
export type InsertJobPanelRate = z.infer<typeof insertJobPanelRateSchema>;
export type JobPanelRate = typeof jobPanelRates.$inferSelect;
export type InsertWorkType = z.infer<typeof insertWorkTypeSchema>;
export type WorkType = typeof workTypes.$inferSelect;
export type InsertPanelTypeCostComponent = z.infer<typeof insertPanelTypeCostComponentSchema>;
export type PanelTypeCostComponent = typeof panelTypeCostComponents.$inferSelect;
export type InsertJobCostOverride = z.infer<typeof insertJobCostOverrideSchema>;
export type JobCostOverride = typeof jobCostOverrides.$inferSelect;
export type InsertTrailerType = z.infer<typeof insertTrailerTypeSchema>;
export type TrailerType = typeof trailerTypes.$inferSelect;
export type InsertLoadList = z.infer<typeof insertLoadListSchema>;
export type LoadList = typeof loadLists.$inferSelect;
export type InsertLoadListPanel = z.infer<typeof insertLoadListPanelSchema>;
export type LoadListPanel = typeof loadListPanels.$inferSelect;
export type InsertDeliveryRecord = z.infer<typeof insertDeliveryRecordSchema>;
export type DeliveryRecord = typeof deliveryRecords.$inferSelect;
export type InsertWeeklyWageReport = z.infer<typeof insertWeeklyWageReportSchema>;
export type WeeklyWageReport = typeof weeklyWageReports.$inferSelect;
export type InsertWeeklyJobReport = z.infer<typeof insertWeeklyJobReportSchema>;
export type WeeklyJobReport = typeof weeklyJobReports.$inferSelect;
export type InsertWeeklyJobReportSchedule = z.infer<typeof insertWeeklyJobReportScheduleSchema>;
export type WeeklyJobReportSchedule = typeof weeklyJobReportSchedules.$inferSelect;
export type WeeklyReportStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;
export type UserPermission = typeof userPermissions.$inferSelect;
export type PermissionLevel = "HIDDEN" | "VIEW" | "VIEW_AND_UPDATE";

export type Role = "USER" | "MANAGER" | "ADMIN";
export type LogStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type JobStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type PanelStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
export type PanelType = "WALL" | "COLUMN" | "CUBE_BASE" | "CUBE_RING" | "LANDING_WALL" | "OTHER";
export type LoadListStatus = "PENDING" | "COMPLETE";
export type ProductionSlotStatus = "SCHEDULED" | "PENDING_UPDATE" | "BOOKED" | "COMPLETED";

export const insertProductionSlotSchema = createInsertSchema(productionSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProductionSlot = z.infer<typeof insertProductionSlotSchema>;
export type ProductionSlot = typeof productionSlots.$inferSelect;

export const insertProductionSlotAdjustmentSchema = createInsertSchema(productionSlotAdjustments).omit({
  id: true,
  createdAt: true,
});
export type InsertProductionSlotAdjustment = z.infer<typeof insertProductionSlotAdjustmentSchema>;
export type ProductionSlotAdjustment = typeof productionSlotAdjustments.$inferSelect;

export const insertDraftingProgramSchema = createInsertSchema(draftingProgram).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDraftingProgram = z.infer<typeof insertDraftingProgramSchema>;
export type DraftingProgram = typeof draftingProgram.$inferSelect;

// ============== Purchase Order Tables ==============

export const suppliers = pgTable("suppliers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyContact: text("key_contact"),
  email: text("email"),
  phone: text("phone"),
  abn: text("abn"),
  acn: text("acn"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  country: text("country").default("Australia"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("suppliers_name_idx").on(table.name),
  abnIdx: index("suppliers_abn_idx").on(table.abn),
}));

export const itemCategories = pgTable("item_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex("item_categories_name_idx").on(table.name),
}));

export const items = pgTable("items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id", { length: 36 }).references(() => itemCategories.id),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  unitOfMeasure: text("unit_of_measure").default("EA"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  minOrderQty: integer("min_order_qty").default(1),
  leadTimeDays: integer("lead_time_days"),
  // Sourcing and compliance fields
  hsCode: text("hs_code"),
  adRisk: text("ad_risk"),
  adReferenceUrl: text("ad_reference_url"),
  complianceNotes: text("compliance_notes"),
  supplierShortlist: text("supplier_shortlist"),
  sources: text("sources"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: index("items_code_idx").on(table.code),
  nameIdx: index("items_name_idx").on(table.name),
  categoryIdx: index("items_category_idx").on(table.categoryId),
  supplierIdx: index("items_supplier_idx").on(table.supplierId),
}));

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  supplierName: text("supplier_name"),
  supplierContact: text("supplier_contact"),
  supplierEmail: text("supplier_email"),
  supplierPhone: text("supplier_phone"),
  supplierAddress: text("supplier_address"),
  requestedById: varchar("requested_by_id", { length: 36 }).notNull().references(() => users.id),
  status: poStatusEnum("status").default("DRAFT").notNull(),
  deliveryAddress: text("delivery_address"),
  requiredByDate: timestamp("required_by_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedById: varchar("rejected_by_id", { length: 36 }).references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  poNumberIdx: uniqueIndex("purchase_orders_po_number_idx").on(table.poNumber),
  statusIdx: index("purchase_orders_status_idx").on(table.status),
  requestedByIdx: index("purchase_orders_requested_by_idx").on(table.requestedById),
  supplierIdx: index("purchase_orders_supplier_idx").on(table.supplierId),
}));

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id", { length: 36 }).notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 36 }).references(() => items.id),
  itemCode: text("item_code"),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  unitOfMeasure: text("unit_of_measure").default("EA"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  poIdx: index("purchase_order_items_po_idx").on(table.purchaseOrderId),
  itemIdx: index("purchase_order_items_item_idx").on(table.itemId),
  sortOrderIdx: index("purchase_order_items_sort_order_idx").on(table.sortOrder),
}));

export const purchaseOrderAttachments = pgTable("purchase_order_attachments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id", { length: 36 }).notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  uploadedById: varchar("uploaded_by_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  poIdx: index("purchase_order_attachments_po_idx").on(table.purchaseOrderId),
  uploadedByIdx: index("purchase_order_attachments_uploaded_by_idx").on(table.uploadedById),
}));

// Insert schemas and types for PO tables
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const insertItemCategorySchema = createInsertSchema(itemCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertItemCategory = z.infer<typeof insertItemCategorySchema>;
export type ItemCategory = typeof itemCategories.$inferSelect;

export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

export const insertPurchaseOrderAttachmentSchema = createInsertSchema(purchaseOrderAttachments).omit({ id: true, createdAt: true });
export type InsertPurchaseOrderAttachment = z.infer<typeof insertPurchaseOrderAttachmentSchema>;
export type PurchaseOrderAttachment = typeof purchaseOrderAttachments.$inferSelect;

export type POStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

// ==================== Task Management (Monday.com-style) ====================

export const taskStatusEnum = pgEnum("task_status", ["NOT_STARTED", "IN_PROGRESS", "STUCK", "DONE", "ON_HOLD"]);

export const taskGroups = pgTable("task_groups", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isCollapsed: boolean("is_collapsed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sortOrderIdx: index("task_groups_sort_order_idx").on(table.sortOrder),
}));

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id", { length: 36 }).notNull().references(() => taskGroups.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id", { length: 36 }),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  status: taskStatusEnum("status").default("NOT_STARTED").notNull(),
  dueDate: timestamp("due_date"),
  reminderDate: timestamp("reminder_date"),
  consultant: text("consultant"),
  projectStage: text("project_stage"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdById: varchar("created_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  groupIdx: index("tasks_group_idx").on(table.groupId),
  parentIdx: index("tasks_parent_idx").on(table.parentId),
  jobIdx: index("tasks_job_idx").on(table.jobId),
  statusIdx: index("tasks_status_idx").on(table.status),
  sortOrderIdx: index("tasks_sort_order_idx").on(table.sortOrder),
  reminderIdx: index("tasks_reminder_idx").on(table.reminderDate),
}));

export const taskAssignees = pgTable("task_assignees", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskUserIdx: uniqueIndex("task_assignees_task_user_idx").on(table.taskId, table.userId),
  taskIdx: index("task_assignees_task_idx").on(table.taskId),
  userIdx: index("task_assignees_user_idx").on(table.userId),
}));

export const taskUpdates = pgTable("task_updates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("task_updates_task_idx").on(table.taskId),
  createdAtIdx: index("task_updates_created_at_idx").on(table.createdAt),
}));

export const taskFiles = pgTable("task_files", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  updateId: varchar("update_id", { length: 36 }).references(() => taskUpdates.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedById: varchar("uploaded_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  taskIdx: index("task_files_task_idx").on(table.taskId),
  updateIdx: index("task_files_update_idx").on(table.updateId),
}));

// Task Management Insert Schemas and Types
export const insertTaskGroupSchema = createInsertSchema(taskGroups).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaskGroup = z.infer<typeof insertTaskGroupSchema>;
export type TaskGroup = typeof taskGroups.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export const insertTaskAssigneeSchema = createInsertSchema(taskAssignees).omit({ id: true, createdAt: true });
export type InsertTaskAssignee = z.infer<typeof insertTaskAssigneeSchema>;
export type TaskAssignee = typeof taskAssignees.$inferSelect;

export const insertTaskUpdateSchema = createInsertSchema(taskUpdates).omit({ id: true, createdAt: true });
export type InsertTaskUpdate = z.infer<typeof insertTaskUpdateSchema>;
export type TaskUpdate = typeof taskUpdates.$inferSelect;

export const insertTaskFileSchema = createInsertSchema(taskFiles).omit({ id: true, createdAt: true });
export type InsertTaskFile = z.infer<typeof insertTaskFileSchema>;
export type TaskFile = typeof taskFiles.$inferSelect;

export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "STUCK" | "DONE" | "ON_HOLD";

// Task Notifications
export const taskNotificationTypeEnum = pgEnum("task_notification_type", ["UPDATE", "COMMENT", "FILE"]);

export const taskNotifications = pgTable("task_notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id, { onDelete: "cascade" }),
  updateId: varchar("update_id", { length: 36 }).references(() => taskUpdates.id, { onDelete: "cascade" }),
  type: taskNotificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  fromUserId: varchar("from_user_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => ({
  userCreatedIdx: index("task_notif_user_created_idx").on(table.userId, table.createdAt),
  taskIdx: index("task_notif_task_idx").on(table.taskId),
}));

export const insertTaskNotificationSchema = createInsertSchema(taskNotifications).omit({ id: true, createdAt: true });
export type InsertTaskNotification = z.infer<typeof insertTaskNotificationSchema>;
export type TaskNotification = typeof taskNotifications.$inferSelect;

// ===============================
// CHAT SYSTEM TABLES
// ===============================

export const conversationTypeEnum = pgEnum("conversation_type", ["DM", "GROUP", "CHANNEL"]);
export const memberRoleEnum = pgEnum("member_role", ["OWNER", "ADMIN", "MEMBER"]);
export const messageFormatEnum = pgEnum("message_format", ["PLAIN", "MARKDOWN"]);
export const chatNotificationTypeEnum = pgEnum("chat_notification_type", ["MESSAGE", "MENTION"]);

export const userChatSettings = pgTable("user_chat_settings", {
  userId: varchar("user_id", { length: 36 }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
  popupEnabled: boolean("popup_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  popupIdx: index("user_chat_settings_popup_idx").on(table.popupEnabled),
}));

export const conversations = pgTable("conversations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  type: conversationTypeEnum("type").notNull(),
  name: text("name"),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "set null" }),
  panelId: varchar("panel_id", { length: 36 }).references(() => panelRegister.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("conversations_type_idx").on(table.type),
  jobIdx: index("conversations_job_idx").on(table.jobId),
  panelIdx: index("conversations_panel_idx").on(table.panelId),
}));

export const conversationMembers = pgTable("conversation_members", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").default("MEMBER").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at"),
  lastReadMsgId: varchar("last_read_msg_id", { length: 36 }),
}, (table) => ({
  uniqMember: uniqueIndex("conv_member_unique").on(table.conversationId, table.userId),
  userIdx: index("conv_member_user_idx").on(table.userId),
  convIdx: index("conv_member_conv_idx").on(table.conversationId),
}));

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body"),
  bodyFormat: messageFormatEnum("body_format").default("PLAIN").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  replyToId: varchar("reply_to_id", { length: 36 }),
}, (table) => ({
  convCreatedIdx: index("messages_conv_created_idx").on(table.conversationId, table.createdAt),
}));

export const chatMessageAttachments = pgTable("chat_message_attachments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id", { length: 36 }).notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  msgIdx: index("chat_attachments_message_idx").on(table.messageId),
}));

export const chatMessageReactions = pgTable("chat_message_reactions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id", { length: 36 }).notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqReaction: uniqueIndex("chat_reaction_unique").on(table.messageId, table.userId, table.emoji),
  messageIdx: index("chat_reactions_message_idx").on(table.messageId),
}));

export const chatMessageMentions = pgTable("chat_message_mentions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id", { length: 36 }).notNull().references(() => chatMessages.id, { onDelete: "cascade" }),
  mentionedUserId: varchar("mentioned_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqMention: uniqueIndex("chat_mention_unique").on(table.messageId, table.mentionedUserId),
  userIdx: index("chat_mention_user_idx").on(table.mentionedUserId),
}));

export const chatNotifications = pgTable("chat_notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  type: chatNotificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  conversationId: varchar("conversation_id", { length: 36 }).references(() => conversations.id, { onDelete: "cascade" }),
  messageId: varchar("message_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
}, (table) => ({
  userCreatedIdx: index("chat_notif_user_created_idx").on(table.userId, table.createdAt),
}));

// Chat Insert Schemas and Types
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertConversationMemberSchema = createInsertSchema(conversationMembers).omit({ id: true, joinedAt: true });
export type InsertConversationMember = z.infer<typeof insertConversationMemberSchema>;
export type ConversationMember = typeof conversationMembers.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertChatMessageAttachmentSchema = createInsertSchema(chatMessageAttachments).omit({ id: true, createdAt: true });
export type InsertChatMessageAttachment = z.infer<typeof insertChatMessageAttachmentSchema>;
export type ChatMessageAttachment = typeof chatMessageAttachments.$inferSelect;

export type ConversationType = "DM" | "GROUP" | "CHANNEL";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
