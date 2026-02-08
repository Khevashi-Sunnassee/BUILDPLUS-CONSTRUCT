import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, uniqueIndex, index, decimal, real, json, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["USER", "MANAGER", "ADMIN"]);
export const userTypeEnum = pgEnum("user_type", ["EMPLOYEE", "EXTERNAL"]);
export const logStatusEnum = pgEnum("log_status", ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]);
export const disciplineEnum = pgEnum("discipline", ["DRAFTING"]);
export const jobStatusEnum = pgEnum("job_status", ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED", "OPPORTUNITY", "QUOTING", "WON", "LOST", "CANCELLED", "CONTRACTED", "IN_PROGRESS", "PENDING_START", "STARTED"]);
export const opportunityStatusEnum = pgEnum("opportunity_status", ["NEW", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATING", "WON", "LOST", "ON_HOLD"]);
export const salesStageEnum = pgEnum("sales_stage", ["OPPORTUNITY", "PRE_QUALIFICATION", "ESTIMATING", "SUBMITTED", "AWARDED", "LOST"]);
export const opportunityTypeEnum = pgEnum("opportunity_type", ["BUILDER_SELECTED", "OPEN_TENDER", "NEGOTIATED_CONTRACT", "GENERAL_PRICING"]);
export const panelStatusEnum = pgEnum("panel_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "PENDING"]);
export const loadListStatusEnum = pgEnum("load_list_status", ["PENDING", "COMPLETE"]);
export const permissionLevelEnum = pgEnum("permission_level", ["HIDDEN", "VIEW", "VIEW_AND_UPDATE"]);
export const weeklyReportStatusEnum = pgEnum("weekly_report_status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);
export const documentStatusEnum = pgEnum("document_status", ["DRAFT", "IFA", "IFC", "APPROVED"]);
export const productionSlotStatusEnum = pgEnum("production_slot_status", ["SCHEDULED", "PENDING_UPDATE", "BOOKED", "COMPLETED"]);
export const poStatusEnum = pgEnum("po_status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "RECEIVED", "RECEIVED_IN_PART"]);
export const draftingProgramStatusEnum = pgEnum("drafting_program_status", ["NOT_SCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]);
export const contractStatusEnum = pgEnum("contract_status", ["AWAITING_CONTRACT", "CONTRACT_REVIEW", "CONTRACT_EXECUTED"]);
export const contractTypeEnum = pgEnum("contract_type", ["LUMP_SUM", "UNIT_PRICE", "TIME_AND_MATERIALS", "GMP"]);
export const progressClaimStatusEnum = pgEnum("progress_claim_status", ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);

export const companies = pgTable("companies", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  logoBase64: text("logo_base64"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  abn: text("abn"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("companies_code_idx").on(table.code),
  activeIdx: index("companies_active_idx").on(table.isActive),
}));

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const departments = pgTable("departments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeCompanyIdx: uniqueIndex("departments_code_company_idx").on(table.code, table.companyId),
  companyIdx: index("departments_company_idx").on(table.companyId),
}));

export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  email: text("email").notNull(),
  name: text("name"),
  phone: text("phone"),
  address: text("address"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").default("USER").notNull(),
  userType: userTypeEnum("user_type").default("EMPLOYEE").notNull(),
  departmentId: varchar("department_id", { length: 36 }).references(() => departments.id),
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
  defaultFactoryId: varchar("default_factory_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  emailCompanyIdx: uniqueIndex("users_email_company_idx").on(table.email, table.companyId),
  companyIdx: index("users_company_idx").on(table.companyId),
}));

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
  "admin_customers",
  "contract_hub",
  "progress_claims",
  "admin_assets",
] as const;

export type FunctionKey = typeof FUNCTION_KEYS[number];

export const devices = pgTable("devices", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  deviceName: text("device_name").notNull(),
  os: text("os").notNull(),
  agentVersion: text("agent_version"),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  lastSeenAt: timestamp("last_seen_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("devices_company_idx").on(table.companyId),
}));

export const cfmeuCalendarEnum = pgEnum("cfmeu_calendar", ["NONE", "CFMEU_QLD", "CFMEU_VIC"]);

export const globalSettings = pgTable("global_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
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
  poTermsHtml: text("po_terms_html"),
  includePOTerms: boolean("include_po_terms").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: uniqueIndex("global_settings_company_idx").on(table.companyId),
}));

export const australianStateEnum = pgEnum("australian_state", ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

export const cfmeuCalendarTypeEnum = pgEnum("cfmeu_calendar_type", ["VIC_ONSITE", "VIC_OFFSITE", "QLD"]);
export const cfmeuHolidayTypeEnum = pgEnum("cfmeu_holiday_type", ["RDO", "PUBLIC_HOLIDAY", "OTHER"]);

export const cfmeuHolidays = pgTable("cfmeu_holidays", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  calendarType: cfmeuCalendarTypeEnum("calendar_type").notNull(),
  date: timestamp("date").notNull(),
  name: text("name").notNull(),
  holidayType: cfmeuHolidayTypeEnum("holiday_type").default("RDO").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  calendarDateCompanyIdx: uniqueIndex("cfmeu_holidays_calendar_date_company_idx").on(table.calendarType, table.date, table.companyId),
  yearIdx: index("cfmeu_holidays_year_idx").on(table.year),
  companyIdx: index("cfmeu_holidays_company_idx").on(table.companyId),
}));

export const factories = pgTable("factories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
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
  codeCompanyIdx: uniqueIndex("factories_code_company_idx").on(table.code, table.companyId),
  activeIdx: index("factories_active_idx").on(table.isActive),
  companyIdx: index("factories_company_idx").on(table.companyId),
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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeCompanyIdx: uniqueIndex("zones_code_company_idx").on(table.code, table.companyId),
  companyIdx: index("zones_company_idx").on(table.companyId),
}));

export const insertZoneSchema = createInsertSchema(zones).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zones.$inferSelect;

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  jobNumber: text("job_number").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  client: text("client"),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
  address: text("address"),
  city: text("city"),
  state: australianStateEnum("state"),
  siteContact: text("site_contact"),
  siteContactPhone: text("site_contact_phone"),
  description: text("description"),
  craneCapacity: text("crane_capacity"),
  numberOfBuildings: integer("number_of_buildings"),
  levels: text("levels"),
  lowestLevel: text("lowest_level"),
  highestLevel: text("highest_level"),
  productionStartDate: timestamp("production_start_date"),
  expectedCycleTimePerFloor: integer("expected_cycle_time_per_floor"),
  daysInAdvance: integer("days_in_advance").default(7),
  daysToAchieveIfc: integer("days_to_achieve_ifc"),
  productionWindowDays: integer("production_window_days"),
  productionDaysInAdvance: integer("production_days_in_advance"),
  procurementDaysInAdvance: integer("procurement_days_in_advance"),
  procurementTimeDays: integer("procurement_time_days"),
  projectManagerId: varchar("project_manager_id", { length: 36 }).references(() => users.id),
  factoryId: varchar("factory_id", { length: 36 }).references(() => factories.id),
  productionSlotColor: text("production_slot_color"),
  jobPhase: integer("job_phase").default(0).notNull(),
  status: jobStatusEnum("status").default("ACTIVE").notNull(),
  referrer: text("referrer"),
  engineerOnJob: text("engineer_on_job"),
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  numberOfLevels: integer("number_of_levels"),
  opportunityStatus: opportunityStatusEnum("opportunity_status"),
  salesStage: salesStageEnum("sales_stage"),
  salesStatus: text("sales_status"),
  opportunityType: opportunityTypeEnum("opportunity_type"),
  primaryContact: text("primary_contact"),
  probability: integer("probability"),
  estimatedStartDate: timestamp("estimated_start_date"),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobNumberCompanyIdx: uniqueIndex("jobs_job_number_company_idx").on(table.jobNumber, table.companyId),
  statusIdx: index("jobs_status_idx").on(table.status),
  jobPhaseIdx: index("jobs_job_phase_idx").on(table.jobPhase),
  codeIdx: index("jobs_code_idx").on(table.code),
  projectManagerIdx: index("jobs_project_manager_idx").on(table.projectManagerId),
  factoryIdx: index("jobs_factory_idx").on(table.factoryId),
  companyIdx: index("jobs_company_idx").on(table.companyId),
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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeCompanyIdx: uniqueIndex("work_types_code_company_idx").on(table.code, table.companyId),
  sortOrderIdx: index("work_types_sort_order_idx").on(table.sortOrder),
  companyIdx: index("work_types_company_idx").on(table.companyId),
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
  // Basic panel info fields
  fireRate: text("fire_rate"),
  caulkingFire: text("caulking_fire"),
  numRebates: integer("num_rebates"),
  openings: text("openings"),
  netWeight: text("net_weight"),
  grossArea: text("gross_area"),
  craneCapacityWeight: text("crane_capacity_weight"),
  craneCheck: text("crane_check"),
  // Concrete fields
  groutTableManual: text("grout_table_manual"),
  groutToUse: text("grout_to_use"),
  groutStrength: text("grout_strength"),
  // Vertical Reo
  verticalReoQty: text("vertical_reo_qty"),
  verticalReoType: text("vertical_reo_type"),
  // Horizontal Reo
  horizontalReoQty: text("horizontal_reo_qty"),
  horizontalReoType: text("horizontal_reo_type"),
  // Mesh
  meshQty: text("mesh_qty"),
  meshType: text("mesh_type"),
  // Fitments Reo
  fitmentsReoQty: text("fitments_reo_qty"),
  fitmentsReoType: text("fitments_reo_type"),
  // U bars
  uBarsQty: text("u_bars_qty"),
  uBarsType: text("u_bars_type"),
  // Ligs
  ligsQty: text("ligs_qty"),
  ligsType: text("ligs_type"),
  // Blockout bars
  blockoutBarsQty: text("blockout_bars_qty"),
  blockoutBarsType: text("blockout_bars_type"),
  // Additional reo (4 sets)
  additionalReoQty1: text("additional_reo_qty_1"),
  additionalReoType1: text("additional_reo_type_1"),
  additionalReoQty2: text("additional_reo_qty_2"),
  additionalReoType2: text("additional_reo_type_2"),
  additionalReoQty3: text("additional_reo_qty_3"),
  additionalReoType3: text("additional_reo_type_3"),
  additionalReoQty4: text("additional_reo_qty_4"),
  additionalReoType4: text("additional_reo_type_4"),
  // Top Fixing
  topFixingQty: text("top_fixing_qty"),
  topFixingType: text("top_fixing_type"),
  // Trimmer bars
  trimmerBarsQty: text("trimmer_bars_qty"),
  trimmerBarsType: text("trimmer_bars_type"),
  // Ligs Reo
  ligsReoQty: text("ligs_reo_qty"),
  ligsReoType: text("ligs_reo_type"),
  additionalReoType: text("additional_reo_type"),
  // Tie reinforcement
  tieReinforcement: text("tie_reinforcement"),
  additionalReoQty: text("additional_reo_qty"),
  additionalReoFrlType: text("additional_reo_frl_type"),
  // Grout Tubes
  groutTubesBottomQty: text("grout_tubes_bottom_qty"),
  groutTubesBottomType: text("grout_tubes_bottom_type"),
  groutTubesTopQty: text("grout_tubes_top_qty"),
  groutTubesTopType: text("grout_tubes_top_type"),
  // Fitments (4 sets)
  ferrulesQty: text("ferrules_qty"),
  ferrulesType: text("ferrules_type"),
  fitmentsQty2: text("fitments_qty_2"),
  fitmentsType2: text("fitments_type_2"),
  fitmentsQty3: text("fitments_qty_3"),
  fitmentsType3: text("fitments_type_3"),
  fitmentsQty4: text("fitments_qty_4"),
  fitmentsType4: text("fitments_type_4"),
  // Plates (4 sets)
  platesQty: text("plates_qty"),
  platesType: text("plates_type"),
  platesQty2: text("plates_qty_2"),
  platesType2: text("plates_type_2"),
  platesQty3: text("plates_qty_3"),
  platesType3: text("plates_type_3"),
  platesQty4: text("plates_qty_4"),
  platesType4: text("plates_type_4"),
  // TYPICAL Dowel Bars
  dowelBarsLength: text("dowel_bars_length"),
  dowelBarsQty: text("dowel_bars_qty"),
  dowelBarsType: text("dowel_bars_type"),
  // END Dowel Bars
  dowelBarsLength2: text("dowel_bars_length_2"),
  dowelBarsQty2: text("dowel_bars_qty_2"),
  dowelBarsType2: text("dowel_bars_type_2"),
  // Lifters
  lifterQtyA: text("lifter_qty_a"),
  liftersType: text("lifters_type"),
  lifterQtyB: text("lifter_qty_b"),
  safetyLiftersType: text("safety_lifters_type"),
  lifterQtyC: text("lifter_qty_c"),
  faceLiftersType: text("face_lifters_type"),
  // Other Inserts
  insertsQtyD: text("inserts_qty_d"),
  insertTypeD: text("insert_type_d"),
  unitCheck: text("unit_check"),
  order: text("order"),
  horizontalReoText: text("horizontal_reo_text"),
  horizontalReoAt: text("horizontal_reo_at"),
  // Reo bar counts
  reoR6: text("reo_r6"),
  reoN10: text("reo_n10"),
  reoN12: text("reo_n12"),
  reoN16: text("reo_n16"),
  reoN20: text("reo_n20"),
  reoN24: text("reo_n24"),
  reoN28: text("reo_n28"),
  reoN32: text("reo_n32"),
  // Mesh counts
  meshSl82: text("mesh_sl82"),
  meshSl92: text("mesh_sl92"),
  meshSl102: text("mesh_sl102"),
  // Dowel bar counts
  dowelN20: text("dowel_n20"),
  dowelN24: text("dowel_n24"),
  dowelN28: text("dowel_n28"),
  dowelN32: text("dowel_n32"),
  dowelN36: text("dowel_n36"),
  // Totals
  reoTons: text("reo_tons"),
  dowelsTons: text("dowels_tons"),
  totalReo: text("total_reo"),
  totalKgM3: text("total_kg_m3"),
  contract: text("contract"),
  reoContract: text("reo_contract"),
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
  lifecycleStatus: integer("lifecycle_status").default(0).notNull(),
  consolidatedIntoPanelId: varchar("consolidated_into_panel_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("panel_register_job_id_idx").on(table.jobId),
  panelMarkIdx: index("panel_register_panel_mark_idx").on(table.panelMark),
  panelTypeIdx: index("panel_register_panel_type_idx").on(table.panelType),
  statusIdx: index("panel_register_status_idx").on(table.status),
  jobPanelIdx: uniqueIndex("panel_register_job_panel_idx").on(table.jobId, table.panelMark),
  approvedForProductionIdx: index("panel_register_approved_for_production_idx").on(table.approvedForProduction),
  lifecycleStatusIdx: index("panel_register_lifecycle_status_idx").on(table.lifecycleStatus),
}));

export const panelAuditLogs = pgTable("panel_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  changedFields: jsonb("changed_fields"),
  previousLifecycleStatus: integer("previous_lifecycle_status"),
  newLifecycleStatus: integer("new_lifecycle_status"),
  changedById: varchar("changed_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  panelIdIdx: index("panel_audit_logs_panel_id_idx").on(table.panelId),
  createdAtIdx: index("panel_audit_logs_created_at_idx").on(table.createdAt),
}));

export const insertPanelAuditLogSchema = createInsertSchema(panelAuditLogs).omit({ id: true, createdAt: true });
export type InsertPanelAuditLog = z.infer<typeof insertPanelAuditLogSchema>;
export type PanelAuditLog = typeof panelAuditLogs.$inferSelect;

export const jobAuditLogs = pgTable("job_audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  changedFields: jsonb("changed_fields"),
  previousPhase: text("previous_phase"),
  newPhase: text("new_phase"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  changedById: varchar("changed_by_id", { length: 36 }).references(() => users.id),
  changedByName: text("changed_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("job_audit_logs_job_id_idx").on(table.jobId),
  createdAtIdx: index("job_audit_logs_created_at_idx").on(table.createdAt),
}));

export const insertJobAuditLogSchema = createInsertSchema(jobAuditLogs).omit({ id: true, createdAt: true });
export type InsertJobAuditLog = z.infer<typeof insertJobAuditLogSchema>;
export type JobAuditLog = typeof jobAuditLogs.$inferSelect;

export const PANEL_LIFECYCLE_STATUS = {
  REGISTERED: 0,
  DIMENSIONS_CONFIRMED: 1,
  DRAFTING: 2,
  IFA: 3,
  IFC: 4,
  MATERIALS_ORDERED: 5,
  PRODUCTION_APPROVED: 6,
  IN_PRODUCTION: 7,
  PRODUCED: 8,
  QA_PASSED: 9,
  ON_LOAD_LIST: 10,
  SHIPPED: 11,
  RETURNED: 12,
  INSTALLED: 13,
  DEFECTED: 14,
  CLAIMED: 15,
} as const;

export type PanelLifecycleStatus = typeof PANEL_LIFECYCLE_STATUS[keyof typeof PANEL_LIFECYCLE_STATUS];

export const PANEL_LIFECYCLE_LABELS: Record<number, string> = {
  0: "Registered",
  1: "Dimensions Confirmed",
  2: "Drafting",
  3: "IFA",
  4: "IFC",
  5: "Materials Ordered",
  6: "Production Approved",
  7: "In Production",
  8: "Produced",
  9: "QA Passed",
  10: "On Load List",
  11: "Shipped",
  12: "Returned",
  13: "Installed",
  14: "Defected",
  15: "Claimed",
};

export const PANEL_LIFECYCLE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600" },
  1: { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", border: "border-sky-300 dark:border-sky-700" },
  2: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  3: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-300 dark:border-violet-700" },
  4: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  5: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  6: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  7: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-300 dark:border-yellow-700" },
  8: { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-700 dark:text-lime-300", border: "border-lime-300 dark:border-lime-700" },
  9: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  10: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-300 dark:border-teal-700" },
  11: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" },
  12: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300 dark:border-rose-700" },
  13: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" },
  14: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  15: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-300 dark:border-indigo-700" },
};

export const mappingRules = pgTable("mapping_rules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  pathContains: text("path_contains").notNull(),
  priority: integer("priority").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  priorityIdx: index("mapping_rules_priority_idx").on(table.priority),
  jobIdIdx: index("mapping_rules_job_id_idx").on(table.jobId),
  companyIdx: index("mapping_rules_company_idx").on(table.companyId),
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

// Timer sessions for tracking drafting time
export const timerStatusEnum = pgEnum("timer_status", ["RUNNING", "PAUSED", "COMPLETED", "CANCELLED"]);

export const timerSessions = pgTable("timer_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  dailyLogId: varchar("daily_log_id", { length: 36 }).references(() => dailyLogs.id),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  panelRegisterId: varchar("panel_register_id", { length: 36 }).references(() => panelRegister.id),
  workTypeId: integer("work_type_id").references(() => workTypes.id),
  app: text("app"),
  status: timerStatusEnum("status").default("RUNNING").notNull(),
  startedAt: timestamp("started_at").notNull(),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  totalElapsedMs: integer("total_elapsed_ms").default(0).notNull(),
  pauseCount: integer("pause_count").default(0).notNull(),
  notes: text("notes"),
  logRowId: varchar("log_row_id", { length: 36 }).references(() => logRows.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("timer_sessions_user_id_idx").on(table.userId),
  dailyLogIdIdx: index("timer_sessions_daily_log_id_idx").on(table.dailyLogId),
  statusIdx: index("timer_sessions_status_idx").on(table.status),
  startedAtIdx: index("timer_sessions_started_at_idx").on(table.startedAt),
}));

// Timer events for tracking history of all timer actions
export const timerEventTypeEnum = pgEnum("timer_event_type", ["START", "PAUSE", "RESUME", "STOP", "CANCEL"]);

export const timerEvents = pgTable("timer_events", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  timerSessionId: varchar("timer_session_id", { length: 36 }).notNull().references(() => timerSessions.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  eventType: timerEventTypeEnum("event_type").notNull(),
  elapsedMsAtEvent: integer("elapsed_ms_at_event").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  timerSessionIdIdx: index("timer_events_timer_session_id_idx").on(table.timerSessionId),
  userIdIdx: index("timer_events_user_id_idx").on(table.userId),
  eventTypeIdx: index("timer_events_event_type_idx").on(table.eventType),
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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  code: text("code").notNull(),
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
  color: text("color"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeCompanyIdx: uniqueIndex("panel_types_code_company_idx").on(table.code, table.companyId),
  companyIdx: index("panel_types_company_idx").on(table.companyId),
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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameCompanyIdx: uniqueIndex("trailer_types_name_company_idx").on(table.name, table.companyId),
  companyIdx: index("trailer_types_company_idx").on(table.companyId),
}));

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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  weekStartDate: text("week_start_date").notNull(),
  weekEndDate: text("week_end_date").notNull(),
  factory: text("factory").default("QLD").notNull(),
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
  weekFactoryCompanyIdx: uniqueIndex("weekly_wage_reports_week_factory_company_idx").on(table.weekStartDate, table.weekEndDate, table.factory, table.companyId),
  factoryIdx: index("weekly_wage_reports_factory_idx").on(table.factory),
  weekStartIdx: index("weekly_wage_reports_week_start_idx").on(table.weekStartDate),
  companyIdx: index("weekly_wage_reports_company_idx").on(table.companyId),
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

export const salesStatusHistory = pgTable("sales_status_history", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  salesStage: text("sales_stage").notNull(),
  salesStatus: text("sales_status").notNull(),
  note: text("note"),
  changedByUserId: varchar("changed_by_user_id", { length: 36 }).references(() => users.id),
  changedByName: text("changed_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  jobIdx: index("sales_status_history_job_idx").on(table.jobId),
  companyIdx: index("sales_status_history_company_idx").on(table.companyId),
}));

export const insertSalesStatusHistorySchema = createInsertSchema(salesStatusHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertSalesStatusHistory = z.infer<typeof insertSalesStatusHistorySchema>;
export type SalesStatusHistory = typeof salesStatusHistory.$inferSelect;

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

export const insertTimerSessionSchema = createInsertSchema(timerSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimerEventSchema = createInsertSchema(timerEvents).omit({
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

export const returnTypeEnum = pgEnum("return_type", ["FULL", "PARTIAL"]);

export const loadReturns = pgTable("load_returns", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  loadListId: varchar("load_list_id", { length: 36 }).notNull().references(() => loadLists.id, { onDelete: "cascade" }),
  returnType: returnTypeEnum("return_type").notNull(),
  returnReason: text("return_reason").notNull(),
  returnDate: text("return_date"),
  leftFactoryTime: text("left_factory_time"),
  arrivedFactoryTime: text("arrived_factory_time"),
  unloadedAtFactoryTime: text("unloaded_at_factory_time"),
  notes: text("notes"),
  returnedById: varchar("returned_by_id", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  loadListIdIdx: index("load_returns_load_list_id_idx").on(table.loadListId),
  returnDateIdx: index("load_returns_return_date_idx").on(table.returnDate),
}));

export const loadReturnPanels = pgTable("load_return_panels", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  loadReturnId: varchar("load_return_id", { length: 36 }).notNull().references(() => loadReturns.id, { onDelete: "cascade" }),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  loadReturnIdIdx: index("load_return_panels_return_id_idx").on(table.loadReturnId),
  panelIdIdx: index("load_return_panels_panel_id_idx").on(table.panelId),
}));

export const insertLoadReturnSchema = createInsertSchema(loadReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoadReturnPanelSchema = createInsertSchema(loadReturnPanels).omit({
  id: true,
  createdAt: true,
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
export type InsertTimerSession = z.infer<typeof insertTimerSessionSchema>;
export type TimerSession = typeof timerSessions.$inferSelect;
export type InsertTimerEvent = z.infer<typeof insertTimerEventSchema>;
export type TimerEvent = typeof timerEvents.$inferSelect;
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
export type InsertLoadReturn = z.infer<typeof insertLoadReturnSchema>;
export type LoadReturn = typeof loadReturns.$inferSelect;
export type InsertLoadReturnPanel = z.infer<typeof insertLoadReturnPanelSchema>;
export type LoadReturnPanel = typeof loadReturnPanels.$inferSelect;
export type ReturnType = "FULL" | "PARTIAL";
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

export const customers = pgTable("customers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
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
  nameIdx: index("customers_name_idx").on(table.name),
  abnIdx: index("customers_abn_idx").on(table.abn),
  companyIdx: index("customers_company_idx").on(table.companyId),
}));

export const suppliers = pgTable("suppliers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
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
  companyIdx: index("suppliers_company_idx").on(table.companyId),
}));

export const itemCategories = pgTable("item_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameCompanyIdx: uniqueIndex("item_categories_name_company_idx").on(table.name, table.companyId),
  companyIdx: index("item_categories_company_idx").on(table.companyId),
}));

export const items = pgTable("items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id", { length: 36 }).references(() => itemCategories.id),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  unitOfMeasure: text("unit_of_measure").default("EA"),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  minOrderQty: integer("min_order_qty").default(1),
  leadTimeDays: integer("lead_time_days"),
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
  companyIdx: index("items_company_idx").on(table.companyId),
}));

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  poNumber: text("po_number").notNull(),
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
  poNumberCompanyIdx: uniqueIndex("purchase_orders_po_number_company_idx").on(table.poNumber, table.companyId),
  statusIdx: index("purchase_orders_status_idx").on(table.status),
  requestedByIdx: index("purchase_orders_requested_by_idx").on(table.requestedById),
  supplierIdx: index("purchase_orders_supplier_idx").on(table.supplierId),
  companyIdx: index("purchase_orders_company_idx").on(table.companyId),
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
  received: boolean("received").default(false).notNull(),
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
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isCollapsed: boolean("is_collapsed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sortOrderIdx: index("task_groups_sort_order_idx").on(table.sortOrder),
  companyIdx: index("task_groups_company_idx").on(table.companyId),
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
  priority: varchar("priority", { length: 20 }),
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
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
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
  companyIdx: index("conversations_company_idx").on(table.companyId),
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

// ==================== DOCUMENT MANAGEMENT SYSTEM ====================

export const docMgmtStatusEnum = pgEnum("doc_mgmt_status", ["PRELIM", "IFA", "IFC", "DRAFT", "REVIEW", "APPROVED", "SUPERSEDED", "ARCHIVED"]);

// Document Types - Configurable types with prefix for auto-numbering
export const documentTypesConfig = pgTable("document_types_config", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  typeName: text("type_name").notNull(),
  prefix: varchar("prefix", { length: 10 }).notNull(),
  shortForm: varchar("short_form", { length: 20 }),
  description: text("description"),
  color: varchar("color", { length: 20 }),
  icon: varchar("icon", { length: 50 }),
  requiresApproval: boolean("requires_approval").default(false),
  retentionDays: integer("retention_days"),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  prefixCompanyIdx: uniqueIndex("doc_types_prefix_company_idx").on(table.prefix, table.companyId),
  activeIdx: index("doc_types_active_idx").on(table.isActive),
  companyIdx: index("doc_types_company_idx").on(table.companyId),
}));

// Document Type Statuses - Configurable statuses per document type
export const documentTypeStatuses = pgTable("document_type_statuses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  typeId: varchar("type_id", { length: 36 }).notNull().references(() => documentTypesConfig.id, { onDelete: "cascade" }),
  statusName: text("status_name").notNull(),
  color: varchar("color", { length: 20 }).notNull().default("#6b7280"),
  sortOrder: integer("sort_order").default(0),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("doc_type_statuses_type_idx").on(table.typeId),
  companyIdx: index("doc_type_statuses_company_idx").on(table.companyId),
  activeIdx: index("doc_type_statuses_active_idx").on(table.isActive),
}));

// Document Disciplines - Engineering/trade disciplines
export const documentDisciplines = pgTable("document_disciplines", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  disciplineName: text("discipline_name").notNull(),
  shortForm: varchar("short_form", { length: 10 }),
  color: varchar("color", { length: 20 }),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  activeIdx: index("doc_disciplines_active_idx").on(table.isActive),
  companyIdx: index("doc_disciplines_company_idx").on(table.companyId),
}));

// Document Categories - Optional categorization
export const documentCategories = pgTable("document_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  categoryName: text("category_name").notNull(),
  shortForm: varchar("short_form", { length: 20 }),
  description: text("description"),
  color: varchar("color", { length: 20 }),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  activeIdx: index("doc_categories_active_idx").on(table.isActive),
  companyIdx: index("doc_categories_company_idx").on(table.companyId),
}));

// Main Documents Table - Core document metadata
export const documents = pgTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  
  // Document identification
  documentNumber: varchar("document_number", { length: 50 }),
  title: text("title").notNull(),
  description: text("description"),
  
  // File information
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  fileSha256: varchar("file_sha256", { length: 64 }),
  
  // Classification
  typeId: varchar("type_id", { length: 36 }).references(() => documentTypesConfig.id),
  disciplineId: varchar("discipline_id", { length: 36 }).references(() => documentDisciplines.id),
  categoryId: varchar("category_id", { length: 36 }).references(() => documentCategories.id),
  tags: text("tags"),
  
  // Status and workflow
  status: docMgmtStatusEnum("status").default("DRAFT").notNull(),
  documentTypeStatusId: varchar("document_type_status_id", { length: 36 }).references(() => documentTypeStatuses.id),
  
  // Version control
  version: varchar("version", { length: 10 }).default("1.0").notNull(),
  revision: varchar("revision", { length: 5 }).default("A").notNull(),
  isLatestVersion: boolean("is_latest_version").default(true).notNull(),
  parentDocumentId: varchar("parent_document_id", { length: 36 }),
  changeSummary: text("change_summary"),
  
  // Entity linking
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  panelId: varchar("panel_id", { length: 36 }).references(() => panelRegister.id),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  purchaseOrderId: varchar("purchase_order_id", { length: 36 }).references(() => purchaseOrders.id),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id),
  conversationId: varchar("conversation_id", { length: 36 }).references(() => conversations.id),
  messageId: varchar("message_id", { length: 36 }).references(() => chatMessages.id),
  
  // User tracking
  uploadedBy: varchar("uploaded_by", { length: 36 }).notNull().references(() => users.id),
  approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Confidential flag
  isConfidential: boolean("is_confidential").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("documents_company_idx").on(table.companyId),
  docNumberIdx: index("documents_doc_number_idx").on(table.documentNumber),
  statusIdx: index("documents_status_idx").on(table.status),
  typeIdx: index("documents_type_idx").on(table.typeId),
  disciplineIdx: index("documents_discipline_idx").on(table.disciplineId),
  jobIdx: index("documents_job_idx").on(table.jobId),
  panelIdx: index("documents_panel_idx").on(table.panelId),
  supplierIdx: index("documents_supplier_idx").on(table.supplierId),
  poIdx: index("documents_po_idx").on(table.purchaseOrderId),
  taskIdx: index("documents_task_idx").on(table.taskId),
  conversationIdx: index("documents_conversation_idx").on(table.conversationId),
  messageIdx: index("documents_message_idx").on(table.messageId),
  uploadedByIdx: index("documents_uploaded_by_idx").on(table.uploadedBy),
  latestVersionIdx: index("documents_latest_version_idx").on(table.isLatestVersion),
  parentDocIdx: index("documents_parent_doc_idx").on(table.parentDocumentId),
  createdAtIdx: index("documents_created_at_idx").on(table.createdAt),
  jobLatestIdx: index("documents_job_latest_idx").on(table.jobId, table.isLatestVersion),
  statusLatestIdx: index("documents_status_latest_idx").on(table.status, table.isLatestVersion),
}));

// Document Bundles - Groups of documents with QR code access
export const documentBundles = pgTable("document_bundles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  bundleName: text("bundle_name").notNull(),
  description: text("description"),
  qrCodeId: varchar("qr_code_id", { length: 100 }).notNull().unique(),
  
  // Entity linking
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  
  // Access control
  isPublic: boolean("is_public").default(false),
  allowGuestAccess: boolean("allow_guest_access").default(false),
  expiresAt: timestamp("expires_at"),
  
  // User tracking
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  qrCodeIdx: uniqueIndex("bundles_qr_code_idx").on(table.qrCodeId),
  companyIdx: index("bundles_company_idx").on(table.companyId),
  jobIdx: index("bundles_job_idx").on(table.jobId),
  supplierIdx: index("bundles_supplier_idx").on(table.supplierId),
  createdByIdx: index("bundles_created_by_idx").on(table.createdBy),
  expiresIdx: index("bundles_expires_idx").on(table.expiresAt),
}));

// Document Bundle Items - Join table for bundle-document relationship
export const documentBundleItems = pgTable("document_bundle_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id", { length: 36 }).notNull().references(() => documentBundles.id, { onDelete: "cascade" }),
  documentId: varchar("document_id", { length: 36 }).notNull().references(() => documents.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  addedBy: varchar("added_by", { length: 36 }).notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  bundleDocUnique: uniqueIndex("bundle_doc_unique_idx").on(table.bundleId, table.documentId),
  bundleIdx: index("bundle_items_bundle_idx").on(table.bundleId),
  documentIdx: index("bundle_items_document_idx").on(table.documentId),
}));

// Document Insert Schemas and Types
export const insertDocumentTypeSchema = createInsertSchema(documentTypesConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentType = z.infer<typeof insertDocumentTypeSchema>;
export type DocumentTypeConfig = typeof documentTypesConfig.$inferSelect;

export const insertDocumentTypeStatusSchema = createInsertSchema(documentTypeStatuses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentTypeStatus = z.infer<typeof insertDocumentTypeStatusSchema>;
export type DocumentTypeStatus = typeof documentTypeStatuses.$inferSelect;

export const insertDocumentDisciplineSchema = createInsertSchema(documentDisciplines).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentDiscipline = z.infer<typeof insertDocumentDisciplineSchema>;
export type DocumentDiscipline = typeof documentDisciplines.$inferSelect;

export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;
export type DocumentCategory = typeof documentCategories.$inferSelect;

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const insertDocumentBundleSchema = createInsertSchema(documentBundles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentBundle = z.infer<typeof insertDocumentBundleSchema>;
export type DocumentBundle = typeof documentBundles.$inferSelect;

export const insertDocumentBundleItemSchema = createInsertSchema(documentBundleItems).omit({ id: true, addedAt: true });
export type InsertDocumentBundleItem = z.infer<typeof insertDocumentBundleItemSchema>;
export type DocumentBundleItem = typeof documentBundleItems.$inferSelect;

// Document Bundle Access Logs - Track guest access to bundles
export const documentBundleAccessLogs = pgTable("document_bundle_access_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id", { length: 36 }).notNull().references(() => documentBundles.id, { onDelete: "cascade" }),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id, { onDelete: "set null" }),
  
  // Access type
  accessType: varchar("access_type", { length: 20 }).notNull(), // VIEW_BUNDLE, VIEW_DOCUMENT, DOWNLOAD_DOCUMENT
  
  // Guest information (since they're not registered users)
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Timestamps
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
}, (table) => ({
  bundleIdx: index("bundle_access_logs_bundle_idx").on(table.bundleId),
  documentIdx: index("bundle_access_logs_document_idx").on(table.documentId),
  accessedAtIdx: index("bundle_access_logs_accessed_at_idx").on(table.accessedAt),
}));

export const insertDocumentBundleAccessLogSchema = createInsertSchema(documentBundleAccessLogs).omit({ id: true, accessedAt: true });
export type InsertDocumentBundleAccessLog = z.infer<typeof insertDocumentBundleAccessLogSchema>;
export type DocumentBundleAccessLog = typeof documentBundleAccessLogs.$inferSelect;

// ==================== Reo Scheduling (Procurement Manager) ====================

export const reoScheduleStatusEnum = pgEnum("reo_schedule_status", ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
export const reoScheduleItemStatusEnum = pgEnum("reo_schedule_item_status", ["PENDING", "APPROVED", "REJECTED", "ORDERED"]);

export const reoSchedules = pgTable("reo_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id, { onDelete: "cascade" }),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id, { onDelete: "cascade" }),
  sourceDocumentId: varchar("source_document_id", { length: 36 }).references(() => documents.id),
  status: reoScheduleStatusEnum("status").default("PENDING").notNull(),
  processedAt: timestamp("processed_at"),
  aiModelUsed: text("ai_model_used"),
  aiResponseRaw: text("ai_response_raw"),
  notes: text("notes"),
  createdById: varchar("created_by_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("reo_schedules_company_idx").on(table.companyId),
  panelIdx: index("reo_schedules_panel_idx").on(table.panelId),
  jobIdx: index("reo_schedules_job_idx").on(table.jobId),
  statusIdx: index("reo_schedules_status_idx").on(table.status),
}));

export const reoScheduleItems = pgTable("reo_schedule_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id", { length: 36 }).notNull().references(() => reoSchedules.id, { onDelete: "cascade" }),
  reoType: text("reo_type").notNull(), // Bar, Mesh, Fitment, U-Bar, Lig, etc.
  barSize: text("bar_size"), // N12, N16, N20, etc.
  barShape: text("bar_shape"), // Straight, L-Shape, U-Shape, etc.
  length: decimal("length", { precision: 10, scale: 2 }), // in mm
  quantity: integer("quantity").notNull(),
  weight: decimal("weight", { precision: 10, scale: 2 }), // in kg
  spacing: text("spacing"), // e.g., "200mm c/c"
  zone: text("zone"), // location within panel
  description: text("description"),
  notes: text("notes"),
  status: reoScheduleItemStatusEnum("status").default("PENDING").notNull(),
  purchaseOrderId: varchar("purchase_order_id", { length: 36 }).references(() => purchaseOrders.id),
  purchaseOrderItemId: varchar("purchase_order_item_id", { length: 36 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  scheduleIdx: index("reo_schedule_items_schedule_idx").on(table.scheduleId),
  typeIdx: index("reo_schedule_items_type_idx").on(table.reoType),
  statusIdx: index("reo_schedule_items_status_idx").on(table.status),
  poIdx: index("reo_schedule_items_po_idx").on(table.purchaseOrderId),
}));

// Reo Schedule Insert Schemas and Types
export const insertReoScheduleSchema = createInsertSchema(reoSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReoSchedule = z.infer<typeof insertReoScheduleSchema>;
export type ReoSchedule = typeof reoSchedules.$inferSelect;

export const insertReoScheduleItemSchema = createInsertSchema(reoScheduleItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReoScheduleItem = z.infer<typeof insertReoScheduleItemSchema>;
export type ReoScheduleItem = typeof reoScheduleItems.$inferSelect;

export type ReoScheduleStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ReoScheduleItemStatus = "PENDING" | "APPROVED" | "REJECTED" | "ORDERED";

export type ReoScheduleWithDetails = ReoSchedule & {
  panel?: PanelRegister | null;
  job?: Job | null;
  sourceDocument?: Document | null;
  createdBy?: SafeUser | null;
  items?: ReoScheduleItem[];
};

// Safe user type (excludes sensitive data like passwordHash)
export type SafeUser = Pick<User, 'id' | 'email' | 'name' | 'role'>;

// Extended types with relations
export type DocumentWithDetails = Document & {
  type?: DocumentTypeConfig | null;
  discipline?: DocumentDiscipline | null;
  category?: DocumentCategory | null;
  documentTypeStatus?: DocumentTypeStatus | null;
  job?: Job | null;
  panel?: PanelRegister | null;
  supplier?: Supplier | null;
  uploadedByUser?: SafeUser | null;
};

export type DocumentBundleWithItems = DocumentBundle & {
  items: (DocumentBundleItem & { document: Document })[];
  job?: Job | null;
  supplier?: Supplier | null;
  createdByUser?: SafeUser | null;
};

// ==================== ADVANCED TEMPLATES SYSTEM ====================

// Entity Types - Checklist type categories (Maintenance, Quality, Safety, etc.)
export const entityTypes = pgTable("entity_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  sortOrder: integer("sort_order").default(0),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Entity Subtypes - Sub-categories within checklist types
export const entitySubtypes = pgTable("entity_subtypes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id),
  entityTypeId: varchar("entity_type_id", { length: 36 }).references(() => entityTypes.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Checklist Instance Status Enum
export const checklistInstanceStatusEnum = pgEnum("checklist_instance_status", [
  "draft",
  "in_progress",
  "completed",
  "signed_off",
  "cancelled"
]);

// Checklist Templates - Dynamic form builder templates
export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  entityTypeId: varchar("entity_type_id", { length: 36 }).references(() => entityTypes.id),
  entitySubtypeId: varchar("entity_subtype_id", { length: 36 }).references(() => entitySubtypes.id),
  sections: jsonb("sections").default([]).notNull(),
  phase: integer("phase"),
  isSystem: boolean("is_system").default(false).notNull(),
  hasScoringSystem: boolean("has_scoring_system").default(false),
  maxScore: integer("max_score").default(0),
  autoCreateWorkOrders: boolean("auto_create_work_orders").default(false),
  workOrderPriority: varchar("work_order_priority", { length: 20 }).default("medium"),
  isMandatoryForSystemActivity: boolean("is_mandatory_for_system_activity").default(false),
  systemActivityType: varchar("system_activity_type", { length: 100 }),
  requiredOutcomes: jsonb("required_outcomes").default([]),
  enableNotifications: boolean("enable_notifications").default(false),
  notificationSettings: jsonb("notification_settings").default({}),
  qrCodeEnabled: boolean("qr_code_enabled").default(false),
  qrCodeToken: varchar("qr_code_token", { length: 100 }),
  qrCodeExpiresAt: timestamp("qr_code_expires_at"),
  qrCodeGeneratedAt: timestamp("qr_code_generated_at"),
  qrCodeUsageCount: integer("qr_code_usage_count").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("checklist_templates_company_idx").on(table.companyId),
  entityTypeIdx: index("checklist_templates_entity_type_idx").on(table.entityTypeId),
  entitySubtypeIdx: index("checklist_templates_entity_subtype_idx").on(table.entitySubtypeId),
  activeIdx: index("checklist_templates_active_idx").on(table.isActive),
}));

// Checklist Instances - Filled-out template responses
export const checklistInstances = pgTable("checklist_instances", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id).notNull(),
  templateId: varchar("template_id", { length: 36 }).references(() => checklistTemplates.id).notNull(),
  instanceNumber: varchar("instance_number", { length: 50 }),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id),
  panelId: varchar("panel_id", { length: 36 }).references(() => panelRegister.id),
  customerId: varchar("customer_id", { length: 36 }),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  staffId: varchar("staff_id", { length: 36 }).references(() => users.id),
  location: varchar("location", { length: 255 }),
  assignedTo: varchar("assigned_to", { length: 36 }).references(() => users.id),
  status: checklistInstanceStatusEnum("status").default("draft").notNull(),
  responses: jsonb("responses").default({}).notNull(),
  score: numeric("score", { precision: 10, scale: 2 }),
  maxPossibleScore: integer("max_possible_score").default(0),
  completionRate: numeric("completion_rate", { precision: 5, scale: 2 }).default("0"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by", { length: 36 }).references(() => users.id),
  signedOffBy: varchar("signed_off_by", { length: 36 }).references(() => users.id),
  signedOffAt: timestamp("signed_off_at"),
  signOffComments: text("sign_off_comments"),
  generatedWorkOrders: jsonb("generated_work_orders").default([]),
  entityTypeId: varchar("entity_type_id", { length: 36 }).references(() => entityTypes.id),
  entitySubtypeId: varchar("entity_subtype_id", { length: 36 }).references(() => entitySubtypes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("checklist_instances_company_idx").on(table.companyId),
  templateIdx: index("checklist_instances_template_idx").on(table.templateId),
  statusIdx: index("checklist_instances_status_idx").on(table.status),
  jobIdx: index("checklist_instances_job_idx").on(table.jobId),
  panelIdx: index("checklist_instances_panel_idx").on(table.panelId),
  assignedToIdx: index("checklist_instances_assigned_to_idx").on(table.assignedTo),
}));

// Insert Schemas and Types for Entity Types
export const insertEntityTypeSchema = createInsertSchema(entityTypes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntityType = z.infer<typeof insertEntityTypeSchema>;
export type EntityType = typeof entityTypes.$inferSelect;

// Insert Schemas and Types for Entity Subtypes
export const insertEntitySubtypeSchema = createInsertSchema(entitySubtypes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEntitySubtype = z.infer<typeof insertEntitySubtypeSchema>;
export type EntitySubtype = typeof entitySubtypes.$inferSelect;

// Insert Schemas and Types for Checklist Templates
export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;

// Insert Schemas and Types for Checklist Instances
export const insertChecklistInstanceSchema = createInsertSchema(checklistInstances).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChecklistInstance = z.infer<typeof insertChecklistInstanceSchema>;
export type ChecklistInstance = typeof checklistInstances.$inferSelect;

// Extended Types with Relations
export type ChecklistTemplateWithDetails = ChecklistTemplate & {
  entityType?: EntityType | null;
  entitySubtype?: EntitySubtype | null;
  createdByUser?: SafeUser | null;
};

export type ChecklistInstanceWithDetails = ChecklistInstance & {
  template?: ChecklistTemplate | null;
  job?: Job | null;
  panel?: PanelRegister | null;
  assignedToUser?: SafeUser | null;
  completedByUser?: SafeUser | null;
  signedOffByUser?: SafeUser | null;
};

// Field Type Constants for Template Builder
export const CHECKLIST_FIELD_TYPES = {
  // Basic Fields
  TEXT_FIELD: "text_field",
  TEXTAREA: "textarea",
  NUMBER_FIELD: "number_field",
  RADIO_BUTTON: "radio_button",
  DROPDOWN: "dropdown",
  CHECKBOX: "checkbox",
  // Quality Control Fields
  PASS_FAIL_FLAG: "pass_fail_flag",
  YES_NO_NA: "yes_no_na",
  CONDITION_OPTION: "condition_option",
  INSPECTION_CHECK: "inspection_check",
  // Date & Time Fields
  DATE_FIELD: "date_field",
  TIME_FIELD: "time_field",
  DATETIME_FIELD: "datetime_field",
  // Financial Fields
  AMOUNT_FIELD: "amount_field",
  PERCENTAGE_FIELD: "percentage_field",
  // Database Selector Fields
  JOB_SELECTOR: "job_selector",
  CUSTOMER_SELECTOR: "customer_selector",
  SUPPLIER_SELECTOR: "supplier_selector",
  STAFF_ASSIGNMENT: "staff_assignment",
  // Selection Fields
  PRIORITY_LEVEL: "priority_level",
  RATING_SCALE: "rating_scale",
  // Media & File Fields
  PHOTO_REQUIRED: "photo_required",
  MULTI_PHOTO: "multi_photo",
  FILE_UPLOAD: "file_upload",
  SIGNATURE_FIELD: "signature_field",
  // Progress & Tracking Fields
  PROGRESS_BAR: "progress_bar",
  // Other Fields
  MEASUREMENT_FIELD: "measurement_field",
} as const;

export type ChecklistFieldType = typeof CHECKLIST_FIELD_TYPES[keyof typeof CHECKLIST_FIELD_TYPES];

// Section Structure Type for Template Builder
export type ChecklistSection = {
  id: string;
  name: string;
  description?: string;
  order: number;
  allowRepeats?: boolean;
  items: ChecklistField[];
};

// Field Structure Type for Template Builder
export type ChecklistField = {
  id: string;
  name: string;
  type: ChecklistFieldType;
  description?: string;
  placeholder?: string;
  required?: boolean;
  photoRequired?: boolean;
  defaultValue?: unknown;
  options?: ChecklistFieldOption[];
  validation?: Record<string, unknown>;
  conditions?: ChecklistFieldCondition[];
  images?: ChecklistFieldImage[];
  links?: ChecklistFieldLink[];
  instructions?: string;
  defaultWorkOrderTypeId?: string | null;
  workOrderTriggers?: ChecklistWorkOrderTrigger[];
  min?: number | null;
  max?: number | null;
  step?: number | null;
  dependsOn?: string;
  dependsOnValue?: string;
};

export type ChecklistFieldOption = {
  text: string;
  value: string;
  color?: string;
};

export type ChecklistFieldCondition = {
  id: string;
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value: string | number | boolean;
  action: "show" | "hide";
};

export type ChecklistFieldImage = {
  id: string;
  url: string;
  alt?: string;
  description?: string;
};

export type ChecklistFieldLink = {
  id: string;
  url: string;
  text: string;
  description?: string;
};

export type ChecklistWorkOrderTrigger = {
  id: string;
  operator: string;
  value: string | number | boolean;
  workOrderTitle: string;
  workOrderDescription?: string;
  workOrderPriority?: string;
  workOrderCategoryId?: string;
  assignToUserId?: string;
};

// ==================== BROADCAST MESSAGING SYSTEM ====================

export const broadcastTemplates = pgTable("broadcast_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  message: text("message").notNull(),
  category: varchar("category", { length: 100 }),
  defaultChannels: text("default_channels").array(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBroadcastTemplateSchema = createInsertSchema(broadcastTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBroadcastTemplate = z.infer<typeof insertBroadcastTemplateSchema>;
export type BroadcastTemplate = typeof broadcastTemplates.$inferSelect;

export const broadcastStatusEnum = pgEnum("broadcast_status", ["PENDING", "SENDING", "COMPLETED", "FAILED"]);
export const broadcastChannelEnum = pgEnum("broadcast_channel", ["SMS", "WHATSAPP", "EMAIL"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["PENDING", "SENT", "FAILED"]);
export const recipientTypeEnum = pgEnum("recipient_type", ["ALL_USERS", "SPECIFIC_USERS", "CUSTOM_CONTACTS"]);

export const broadcastMessages = pgTable("broadcast_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  templateId: varchar("template_id", { length: 36 }).references(() => broadcastTemplates.id),
  subject: varchar("subject", { length: 500 }),
  message: text("message").notNull(),
  channels: text("channels").array().notNull(),
  recipientType: recipientTypeEnum("recipient_type").notNull(),
  recipientIds: text("recipient_ids").array(),
  customRecipients: jsonb("custom_recipients"),
  totalRecipients: integer("total_recipients").default(0).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  failedCount: integer("failed_count").default(0).notNull(),
  status: broadcastStatusEnum("status").default("PENDING").notNull(),
  sentBy: varchar("sent_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBroadcastMessageSchema = createInsertSchema(broadcastMessages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBroadcastMessage = z.infer<typeof insertBroadcastMessageSchema>;
export type BroadcastMessage = typeof broadcastMessages.$inferSelect;

export const broadcastDeliveries = pgTable("broadcast_deliveries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  broadcastMessageId: varchar("broadcast_message_id", { length: 36 }).notNull().references(() => broadcastMessages.id, { onDelete: "cascade" }),
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 50 }),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  channel: broadcastChannelEnum("channel").notNull(),
  status: deliveryStatusEnum("status").default("PENDING").notNull(),
  externalMessageId: varchar("external_message_id", { length: 255 }),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBroadcastDeliverySchema = createInsertSchema(broadcastDeliveries).omit({ id: true, createdAt: true });
export type InsertBroadcastDelivery = z.infer<typeof insertBroadcastDeliverySchema>;
export type BroadcastDelivery = typeof broadcastDeliveries.$inferSelect;

export type BroadcastMessageWithDetails = BroadcastMessage & {
  template?: BroadcastTemplate | null;
  sentByUser?: SafeUser | null;
  deliveries?: BroadcastDelivery[];
};

// ============================================================================
// CONTRACT HUB
// ============================================================================

export const contracts = pgTable("contracts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),

  // 1. Core Contract Identification
  contractNumber: text("contract_number"),
  projectName: text("project_name"),
  projectAddress: text("project_address"),
  ownerClientName: text("owner_client_name"),
  generalContractor: text("general_contractor"),
  architectEngineer: text("architect_engineer"),
  contractStatus: contractStatusEnum("contract_status").default("AWAITING_CONTRACT").notNull(),
  contractType: contractTypeEnum("contract_type"),
  originalContractDate: timestamp("original_contract_date"),
  noticeToProceedDate: timestamp("notice_to_proceed_date"),

  // 2. Financial & Commercial Terms
  originalContractValue: decimal("original_contract_value", { precision: 14, scale: 2 }),
  revisedContractValue: decimal("revised_contract_value", { precision: 14, scale: 2 }),
  unitPrices: text("unit_prices"),
  retentionPercentage: decimal("retention_percentage", { precision: 5, scale: 2 }).default("10"),
  retentionCap: decimal("retention_cap", { precision: 14, scale: 2 }).default("5"),
  paymentTerms: text("payment_terms"),
  billingMethod: text("billing_method"),
  taxResponsibility: text("tax_responsibility"),
  escalationClause: boolean("escalation_clause"),
  escalationClauseDetails: text("escalation_clause_details"),
  liquidatedDamagesRate: text("liquidated_damages_rate"),
  liquidatedDamagesStartDate: timestamp("liquidated_damages_start_date"),

  // 3. Scope of Work (Precast-Specific)
  precastScopeDescription: text("precast_scope_description"),
  precastElementsIncluded: jsonb("precast_elements_included"),
  estimatedPieceCount: integer("estimated_piece_count"),
  estimatedTotalWeight: text("estimated_total_weight"),
  estimatedTotalVolume: text("estimated_total_volume"),
  finishRequirements: text("finish_requirements"),
  connectionTypeResponsibility: text("connection_type_responsibility"),

  // 4. Schedule & Milestones
  requiredDeliveryStartDate: timestamp("required_delivery_start_date"),
  requiredDeliveryEndDate: timestamp("required_delivery_end_date"),
  productionStartDate: timestamp("production_start_date"),
  productionFinishDate: timestamp("production_finish_date"),
  erectionStartDate: timestamp("erection_start_date"),
  erectionFinishDate: timestamp("erection_finish_date"),
  criticalMilestones: text("critical_milestones"),
  weekendNightWorkAllowed: boolean("weekend_night_work_allowed"),
  weatherAllowances: text("weather_allowances"),

  // 5. Engineering & Submittals
  designResponsibility: text("design_responsibility"),
  shopDrawingRequired: boolean("shop_drawing_required"),
  submittalDueDate: timestamp("submittal_due_date"),
  submittalApprovalDate: timestamp("submittal_approval_date"),
  revisionCount: integer("revision_count"),
  connectionDesignIncluded: boolean("connection_design_included"),
  stampedCalculationsRequired: boolean("stamped_calculations_required"),

  // 6. Logistics & Site Constraints
  deliveryRestrictions: text("delivery_restrictions"),
  siteAccessConstraints: text("site_access_constraints"),
  craneTypeCapacity: text("crane_type_capacity"),
  unloadingResponsibility: text("unloading_responsibility"),
  laydownAreaAvailable: boolean("laydown_area_available"),
  returnLoadsAllowed: boolean("return_loads_allowed"),

  // 7. Change Management
  approvedChangeOrderValue: decimal("approved_change_order_value", { precision: 14, scale: 2 }),
  pendingChangeOrderValue: decimal("pending_change_order_value", { precision: 14, scale: 2 }),
  changeOrderCount: integer("change_order_count"),
  changeOrderReferenceNumbers: text("change_order_reference_numbers"),
  changeReasonCodes: text("change_reason_codes"),
  timeImpactDays: integer("time_impact_days"),

  // 8. Risk, Legal & Compliance
  performanceBondRequired: boolean("performance_bond_required"),
  paymentBondRequired: boolean("payment_bond_required"),
  insuranceRequirements: text("insurance_requirements"),
  warrantyPeriod: text("warranty_period"),
  indemnificationClauseNotes: text("indemnification_clause_notes"),
  disputeResolutionMethod: text("dispute_resolution_method"),
  governingLaw: text("governing_law"),
  forceMajeureClause: boolean("force_majeure_clause"),

  // 9. Quality & Acceptance
  qualityStandardReference: text("quality_standard_reference"),
  mockupsRequired: boolean("mockups_required"),
  acceptanceCriteria: text("acceptance_criteria"),
  punchListResponsibility: text("punch_list_responsibility"),
  finalAcceptanceDate: timestamp("final_acceptance_date"),

  // 10. Closeout & Completion
  substantialCompletionDate: timestamp("substantial_completion_date"),
  finalCompletionDate: timestamp("final_completion_date"),
  finalRetentionReleaseDate: timestamp("final_retention_release_date"),
  asBuiltsRequired: boolean("as_builts_required"),
  omManualsRequired: boolean("om_manuals_required"),
  warrantyStartDate: timestamp("warranty_start_date"),
  warrantyEndDate: timestamp("warranty_end_date"),

  // 11. Progress Claim Configuration
  claimableAtPhase: integer("claimable_at_phase"),

  // AI Risk Assessment
  riskRating: integer("risk_rating"),
  riskOverview: text("risk_overview"),
  riskHighlights: jsonb("risk_highlights"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  aiSourceDocumentId: varchar("ai_source_document_id", { length: 36 }).references(() => documents.id),

  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdIdx: index("contracts_company_id_idx").on(table.companyId),
  jobIdIdx: index("contracts_job_id_idx").on(table.jobId),
  contractStatusIdx: index("contracts_contract_status_idx").on(table.contractStatus),
  jobCompanyUniqueIdx: uniqueIndex("contracts_job_company_unique_idx").on(table.jobId, table.companyId),
}));

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true, version: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export const progressClaims = pgTable("progress_claims", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  claimNumber: text("claim_number").notNull(),
  status: progressClaimStatusEnum("status").default("DRAFT").notNull(),
  claimDate: timestamp("claim_date").defaultNow().notNull(),
  claimType: text("claim_type").default("DETAIL").notNull(),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("10"),
  taxAmount: decimal("tax_amount", { precision: 14, scale: 2 }).default("0"),
  total: decimal("total", { precision: 14, scale: 2 }).default("0"),
  retentionRate: decimal("retention_rate", { precision: 5, scale: 2 }).default("0"),
  retentionAmount: decimal("retention_amount", { precision: 14, scale: 2 }).default("0"),
  retentionHeldToDate: decimal("retention_held_to_date", { precision: 14, scale: 2 }).default("0"),
  netClaimAmount: decimal("net_claim_amount", { precision: 14, scale: 2 }).default("0"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  createdById: varchar("created_by_id", { length: 36 }).notNull().references(() => users.id),
  approvedById: varchar("approved_by_id", { length: 36 }).references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedById: varchar("rejected_by_id", { length: 36 }).references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at"),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  claimNumberCompanyIdx: uniqueIndex("progress_claims_claim_number_company_idx").on(table.claimNumber, table.companyId),
  statusIdx: index("progress_claims_status_idx").on(table.status),
  jobIdIdx: index("progress_claims_job_id_idx").on(table.jobId),
  companyIdIdx: index("progress_claims_company_id_idx").on(table.companyId),
  createdByIdx: index("progress_claims_created_by_idx").on(table.createdById),
}));

export const progressClaimItems = pgTable("progress_claim_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  progressClaimId: varchar("progress_claim_id", { length: 36 }).notNull().references(() => progressClaims.id, { onDelete: "cascade" }),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  panelMark: text("panel_mark").notNull(),
  level: text("level"),
  panelRevenue: decimal("panel_revenue", { precision: 14, scale: 2 }).notNull(),
  percentComplete: decimal("percent_complete", { precision: 5, scale: 2 }).default("0").notNull(),
  lineTotal: decimal("line_total", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  claimIdx: index("progress_claim_items_claim_idx").on(table.progressClaimId),
  panelIdx: index("progress_claim_items_panel_idx").on(table.panelId),
}));

export const eotClaimStatusEnum = pgEnum("eot_claim_status", ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]);
export const eotDelayCategoryEnum = pgEnum("eot_delay_category", ["WEATHER", "CLIENT_DELAY", "DESIGN_CHANGE", "SITE_CONDITIONS", "SUPPLY_CHAIN", "SUBCONTRACTOR", "OTHER"]);

export const eotClaims = pgTable("eot_claims", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  weeklyReportId: varchar("weekly_report_id", { length: 36 }).references(() => weeklyJobReports.id),
  reportScheduleId: varchar("report_schedule_id", { length: 36 }).references(() => weeklyJobReportSchedules.id),
  status: eotClaimStatusEnum("status").default("DRAFT").notNull(),
  claimNumber: text("claim_number").notNull(),
  delayCategory: eotDelayCategoryEnum("delay_category").notNull(),
  description: text("description").notNull(),
  requestedDays: integer("requested_days").notNull(),
  currentCompletionDate: text("current_completion_date"),
  requestedCompletionDate: text("requested_completion_date"),
  supportingNotes: text("supporting_notes"),
  createdById: varchar("created_by_id", { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  reviewedById: varchar("reviewed_by_id", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  approvedDays: integer("approved_days"),
}, (table) => ({
  jobIdx: index("eot_claims_job_idx").on(table.jobId),
  statusIdx: index("eot_claims_status_idx").on(table.status),
  createdByIdx: index("eot_claims_created_by_idx").on(table.createdById),
  weeklyReportIdx: index("eot_claims_weekly_report_idx").on(table.weeklyReportId),
}));

export const insertEotClaimSchema = createInsertSchema(eotClaims).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEotClaim = z.infer<typeof insertEotClaimSchema>;
export type EotClaim = typeof eotClaims.$inferSelect;
export type EotClaimStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type EotDelayCategory = "WEATHER" | "CLIENT_DELAY" | "DESIGN_CHANGE" | "SITE_CONDITIONS" | "SUPPLY_CHAIN" | "SUBCONTRACTOR" | "OTHER";

export const insertProgressClaimSchema = createInsertSchema(progressClaims).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgressClaim = z.infer<typeof insertProgressClaimSchema>;
export type ProgressClaim = typeof progressClaims.$inferSelect;

export const insertProgressClaimItemSchema = createInsertSchema(progressClaimItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgressClaimItem = z.infer<typeof insertProgressClaimItemSchema>;
export type ProgressClaimItem = typeof progressClaimItems.$inferSelect;

export type ProgressClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export const ASSET_CATEGORIES = [
  "Heavy Equipment", "Excavation", "Lifting", "Concrete", "Earthmoving", "Compaction",
  "Site Preparation", "Road Construction", "Drilling", "Demolition",
  "Molds", "Concrete Mixers", "Prestressing", "Casting", "Curing", "Finishing",
  "Material Handling", "Quality Control", "Steam Curing Systems", "Aggregate Processing",
  "Survey", "Planning & Design", "Environmental Testing", "Geotechnical", "Infrastructure",
  "Utility Installation", "Landscaping", "Testing & Inspection", "Safety", "Site Security",
  "Vehicles & Transportation", "Hand Tools & Power Tools", "IT Equipment", "Office Equipment",
  "Workshop Equipment", "Maintenance Equipment", "Storage Systems", "Communication Equipment",
  "Generators & Power Systems", "Furniture", "General Machinery", "Other",
] as const;

export type AssetCategory = typeof ASSET_CATEGORIES[number];

export const ASSET_STATUSES = ["active", "disposed", "sold", "stolen", "lost"] as const;
export type AssetStatus = typeof ASSET_STATUSES[number];

export const ASSET_CONDITIONS = ["new", "excellent", "good", "fair", "poor"] as const;
export type AssetCondition = typeof ASSET_CONDITIONS[number];

export const ASSET_FUNDING_METHODS = ["purchased", "leased", "financed", "donated", "rented"] as const;
export type AssetFundingMethod = typeof ASSET_FUNDING_METHODS[number];

export const assets = pgTable("assets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  assetTag: text("asset_tag").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  status: text("status").default("active"),
  condition: text("condition"),
  location: text("location"),
  department: text("department"),
  assignedTo: text("assigned_to"),
  fundingMethod: text("funding_method"),
  photos: jsonb("photos").default([]),
  purchasePrice: decimal("purchase_price", { precision: 14, scale: 2 }),
  currentValue: decimal("current_value", { precision: 14, scale: 2 }),
  depreciationMethod: text("depreciation_method"),
  depreciationRate: decimal("depreciation_rate", { precision: 6, scale: 2 }),
  accumulatedDepreciation: decimal("accumulated_depreciation", { precision: 14, scale: 2 }),
  depreciationThisPeriod: decimal("depreciation_this_period", { precision: 14, scale: 2 }),
  bookValue: decimal("book_value", { precision: 14, scale: 2 }),
  yearsDepreciated: integer("years_depreciated"),
  usefulLifeYears: integer("useful_life_years"),
  purchaseDate: text("purchase_date"),
  supplier: text("supplier"),
  supplierId: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
  warrantyExpiry: text("warranty_expiry"),
  leaseStartDate: text("lease_start_date"),
  leaseEndDate: text("lease_end_date"),
  leaseMonthlyPayment: decimal("lease_monthly_payment", { precision: 14, scale: 2 }),
  balloonPayment: decimal("balloon_payment", { precision: 14, scale: 2 }),
  leaseTerm: integer("lease_term"),
  lessor: text("lessor"),
  loanAmount: decimal("loan_amount", { precision: 14, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 6, scale: 2 }),
  loanTerm: integer("loan_term"),
  lender: text("lender"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  registrationNumber: text("registration_number"),
  engineNumber: text("engine_number"),
  vinNumber: text("vin_number"),
  yearOfManufacture: text("year_of_manufacture"),
  countryOfOrigin: text("country_of_origin"),
  specifications: text("specifications"),
  operatingHours: decimal("operating_hours", { precision: 10, scale: 1 }),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insurancePremium: decimal("insurance_premium", { precision: 14, scale: 2 }),
  insuranceExcess: decimal("insurance_excess", { precision: 14, scale: 2 }),
  insuranceStartDate: text("insurance_start_date"),
  insuranceExpiryDate: text("insurance_expiry_date"),
  insuranceStatus: text("insurance_status"),
  insuranceNotes: text("insurance_notes"),
  quantity: integer("quantity").default(1),
  barcode: text("barcode"),
  qrCode: text("qr_code"),
  remarks: text("remarks"),
  capexRequestId: text("capex_request_id"),
  capexDescription: text("capex_description"),
  aiSummary: text("ai_summary"),
  lastAudited: timestamp("last_audited"),
  auditNotes: text("audit_notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("assets_company_idx").on(table.companyId),
  statusIdx: index("assets_status_idx").on(table.status),
  categoryIdx: index("assets_category_idx").on(table.category),
  assetTagIdx: uniqueIndex("assets_asset_tag_idx").on(table.assetTag, table.companyId),
}));

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

export const assetMaintenanceRecords = pgTable("asset_maintenance_records", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  maintenanceType: text("maintenance_type").notNull(),
  maintenanceDate: text("maintenance_date").notNull(),
  cost: decimal("cost", { precision: 14, scale: 2 }),
  serviceProvider: text("service_provider"),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  assetIdx: index("maintenance_asset_idx").on(table.assetId),
  companyIdx: index("maintenance_company_idx").on(table.companyId),
}));

export const insertAssetMaintenanceSchema = createInsertSchema(assetMaintenanceRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAssetMaintenance = z.infer<typeof insertAssetMaintenanceSchema>;
export type AssetMaintenance = typeof assetMaintenanceRecords.$inferSelect;

export const assetTransfers = pgTable("asset_transfers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id", { length: 36 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  fromDepartment: text("from_department"),
  toDepartment: text("to_department"),
  fromAssignee: text("from_assignee"),
  toAssignee: text("to_assignee"),
  transferDate: text("transfer_date").notNull(),
  reason: text("reason"),
  transferredBy: text("transferred_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  assetIdx: index("transfer_asset_idx").on(table.assetId),
  companyIdx: index("transfer_company_idx").on(table.companyId),
}))

export const insertAssetTransferSchema = createInsertSchema(assetTransfers).omit({ id: true, createdAt: true });
export type InsertAssetTransfer = z.infer<typeof insertAssetTransferSchema>;
export type AssetTransfer = typeof assetTransfers.$inferSelect;

export const helpScopeEnum = pgEnum("help_scope", ["PAGE", "FIELD", "ACTION", "COLUMN", "ERROR", "GENERAL"]);
export const helpStatusEnum = pgEnum("help_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const helpEntries = pgTable("help_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  scope: helpScopeEnum("scope").notNull().default("GENERAL"),
  title: text("title").notNull(),
  shortText: text("short_text"),
  bodyMd: text("body_md"),
  keywords: text("keywords").array().default([]),
  category: text("category"),
  pageRoute: text("page_route"),
  roleVisibility: text("role_visibility").array().default([]),
  status: helpStatusEnum("status").notNull().default("PUBLISHED"),
  version: integer("version").notNull().default(1),
  rank: integer("rank").notNull().default(0),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  keyIdx: uniqueIndex("help_key_idx").on(table.key),
  scopeIdx: index("help_scope_idx").on(table.scope),
  categoryIdx: index("help_category_idx").on(table.category),
  routeIdx: index("help_route_idx").on(table.pageRoute),
  statusIdx: index("help_status_idx").on(table.status),
  statusUpdatedIdx: index("help_status_updated_idx").on(table.status, table.updatedAt),
}));

export const insertHelpEntrySchema = createInsertSchema(helpEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHelpEntry = z.infer<typeof insertHelpEntrySchema>;
export type HelpEntry = typeof helpEntries.$inferSelect;

export const helpEntryVersions = pgTable("help_entry_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  helpEntryId: varchar("help_entry_id", { length: 36 }).notNull().references(() => helpEntries.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  entryIdx: index("help_version_entry_idx").on(table.helpEntryId),
  keyIdx: index("help_version_key_idx").on(table.key),
}));

export type HelpEntryVersion = typeof helpEntryVersions.$inferSelect;

export const helpFeedback = pgTable("help_feedback", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  helpEntryId: varchar("help_entry_id", { length: 36 }).references(() => helpEntries.id, { onDelete: "set null" }),
  helpKey: text("help_key"),
  userId: text("user_id"),
  rating: integer("rating"),
  comment: text("comment"),
  pageUrl: text("page_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
