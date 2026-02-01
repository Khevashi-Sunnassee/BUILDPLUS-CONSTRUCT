import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["USER", "MANAGER", "ADMIN"]);
export const logStatusEnum = pgEnum("log_status", ["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]);
export const disciplineEnum = pgEnum("discipline", ["DRAFTING"]);
export const jobStatusEnum = pgEnum("job_status", ["ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]);
export const panelStatusEnum = pgEnum("panel_status", ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]);

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").default("USER").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const globalSettings = pgTable("global_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tz: text("tz").default("Australia/Melbourne").notNull(),
  captureIntervalS: integer("capture_interval_s").default(300).notNull(),
  idleThresholdS: integer("idle_threshold_s").default(300).notNull(),
  trackedApps: text("tracked_apps").default("revit,acad").notNull(),
  requireAddins: boolean("require_addins").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").unique(),
  client: text("client"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: text("job_number").notNull().unique(),
  name: text("name").notNull(),
  client: text("client"),
  address: text("address"),
  description: text("description"),
  status: jobStatusEnum("status").default("ACTIVE").notNull(),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobNumberIdx: index("jobs_job_number_idx").on(table.jobNumber),
  statusIdx: index("jobs_status_idx").on(table.status),
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
  status: panelStatusEnum("status").default("NOT_STARTED").notNull(),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdIdx: index("panel_register_job_id_idx").on(table.jobId),
  panelMarkIdx: index("panel_register_panel_mark_idx").on(table.panelMark),
  panelTypeIdx: index("panel_register_panel_type_idx").on(table.panelType),
  statusIdx: index("panel_register_status_idx").on(table.status),
  jobPanelIdx: uniqueIndex("panel_register_job_panel_idx").on(table.jobId, table.panelMark),
}));

export const mappingRules = pgTable("mapping_rules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id),
  pathContains: text("path_contains").notNull(),
  priority: integer("priority").default(100).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  priorityIdx: index("mapping_rules_priority_idx").on(table.priority),
}));

export const dailyLogs = pgTable("daily_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  logDay: text("log_day").notNull(),
  tz: text("tz").default("Australia/Melbourne").notNull(),
  discipline: disciplineEnum("discipline").default("DRAFTING").notNull(),
  status: logStatusEnum("status").default("PENDING").notNull(),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 36 }),
  managerComment: text("manager_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userLogDayDisciplineIdx: uniqueIndex("user_log_day_discipline_idx").on(table.userId, table.logDay, table.discipline),
  logDayIdx: index("daily_logs_log_day_idx").on(table.logDay),
}));

export const logRows = pgTable("log_rows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dailyLogId: varchar("daily_log_id", { length: 36 }).notNull().references(() => dailyLogs.id),
  projectId: varchar("project_id", { length: 36 }).references(() => projects.id),
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
  projectIdIdx: index("log_rows_project_id_idx").on(table.projectId),
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
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("panel_types_code_idx").on(table.code),
}));

export const projectPanelRates = pgTable("project_panel_rates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id", { length: 36 }).notNull().references(() => projects.id),
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
  projectPanelTypeIdx: uniqueIndex("project_panel_rates_project_panel_type_idx").on(table.projectId, table.panelTypeId),
}));

export const productionEntries = pgTable("production_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  panelId: varchar("panel_id", { length: 36 }).notNull().references(() => panelRegister.id),
  jobId: varchar("job_id", { length: 36 }).notNull().references(() => jobs.id),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  productionDate: text("production_date").notNull(),
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

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMappingRuleSchema = createInsertSchema(mappingRules).omit({
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
  id: true,
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

export const insertProductionEntrySchema = createInsertSchema(productionEntries).omit({
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

export const insertProjectPanelRateSchema = createInsertSchema(projectPanelRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  projectId: z.string().optional().nullable(),
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
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertMappingRule = z.infer<typeof insertMappingRuleSchema>;
export type MappingRule = typeof mappingRules.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
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
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertProductionEntry = z.infer<typeof insertProductionEntrySchema>;
export type ProductionEntry = typeof productionEntries.$inferSelect;
export type InsertPanelType = z.infer<typeof insertPanelTypeSchema>;
export type PanelTypeConfig = typeof panelTypes.$inferSelect;
export type InsertProjectPanelRate = z.infer<typeof insertProjectPanelRateSchema>;
export type ProjectPanelRate = typeof projectPanelRates.$inferSelect;
export type InsertWorkType = z.infer<typeof insertWorkTypeSchema>;
export type WorkType = typeof workTypes.$inferSelect;
export type InsertPanelTypeCostComponent = z.infer<typeof insertPanelTypeCostComponentSchema>;
export type PanelTypeCostComponent = typeof panelTypeCostComponents.$inferSelect;
export type InsertJobCostOverride = z.infer<typeof insertJobCostOverrideSchema>;
export type JobCostOverride = typeof jobCostOverrides.$inferSelect;
export type Role = "USER" | "MANAGER" | "ADMIN";
export type LogStatus = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type JobStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type PanelStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "ON_HOLD";
export type PanelType = "WALL" | "COLUMN" | "CUBE_BASE" | "CUBE_RING" | "LANDING_WALL" | "OTHER";
