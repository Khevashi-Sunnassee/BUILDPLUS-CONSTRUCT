import { db } from "./db";
import { users, jobs, dailyLogs, logRows, globalSettings, workTypes, trailerTypes, entityTypes, entitySubtypes, checklistTemplates, checklistInstances, companies, permissionTypes, FUNCTION_KEYS, type PermissionLevel } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import logger from "./lib/logger";

export async function seedDatabase() {
  logger.info("Checking if seed data exists...");

  let existingCompanies = await db.select().from(companies);
  let seedCompanyId: string;
  if (existingCompanies.length === 0) {
    const [company] = await db.insert(companies).values({
      name: "BuildPlus Ai",
      code: "BPA",
    }).returning();
    seedCompanyId = company.id;
    logger.info("Seed company created");
  } else {
    seedCompanyId = existingCompanies[0].id;
  }

  const existingWorkTypes = await db.select().from(workTypes);
  if (existingWorkTypes.length === 0) {
    await db.insert(workTypes).values([
      {
        companyId: seedCompanyId,
        code: "GENERAL",
        name: "General Drafting",
        description: "Standard drafting work",
        sortOrder: 1,
        isActive: true,
      },
      {
        companyId: seedCompanyId,
        code: "CLIENT_CHANGE",
        name: "Client Changes",
        description: "Modifications requested by client",
        sortOrder: 2,
        isActive: true,
      },
      {
        companyId: seedCompanyId,
        code: "ERROR_REWORK",
        name: "Errors/Redrafting",
        description: "Corrections and redrafting of previous work",
        sortOrder: 3,
        isActive: true,
      },
    ]);
    logger.info("Work types seeded");
  }

  const existingTrailerTypes = await db.select().from(trailerTypes);
  if (existingTrailerTypes.length === 0) {
    await db.insert(trailerTypes).values([
      {
        companyId: seedCompanyId,
        name: "Layover",
        description: "Flat deck trailer with panels laying flat",
        sortOrder: 1,
        isActive: true,
      },
      {
        companyId: seedCompanyId,
        name: "A-Frame",
        description: "A-frame trailer with panels standing upright",
        sortOrder: 2,
        isActive: true,
      },
    ]);
    logger.info("Trailer types seeded");
  }

  const existingPermTypes = await db.select().from(permissionTypes);
  if (existingPermTypes.length === 0) {
    const allCompanies = await db.select().from(companies);
    for (const company of allCompanies) {
      const fullAccess: Record<string, PermissionLevel> = {};
      const standardUser: Record<string, PermissionLevel> = {};
      const viewOnly: Record<string, PermissionLevel> = {};
      const productionTeam: Record<string, PermissionLevel> = {};
      const officeAdmin: Record<string, PermissionLevel> = {};

      const adminKeys = FUNCTION_KEYS.filter(k => k.startsWith("admin_"));
      const productionKeys = ["panel_register", "checklists", "production_slots", "production_report", "logistics", "reo_scheduling"];
      const financeKeys = ["sales_pipeline", "contract_hub", "progress_claims", "purchase_orders", "hire_bookings", "capex_requests", "weekly_wages", "budgets"];

      for (const key of FUNCTION_KEYS) {
        fullAccess[key] = "VIEW_AND_UPDATE";
        viewOnly[key] = "VIEW";

        if (adminKeys.includes(key)) {
          standardUser[key] = "HIDDEN";
          productionTeam[key] = "HIDDEN";
          officeAdmin[key] = "VIEW_AND_UPDATE";
        } else if (productionKeys.includes(key)) {
          standardUser[key] = "VIEW";
          productionTeam[key] = "VIEW_AND_UPDATE";
          officeAdmin[key] = "VIEW";
        } else if (financeKeys.includes(key)) {
          standardUser[key] = "VIEW";
          productionTeam[key] = "HIDDEN";
          officeAdmin[key] = "VIEW_AND_UPDATE";
        } else {
          standardUser[key] = "VIEW_AND_UPDATE";
          productionTeam[key] = "VIEW";
          officeAdmin[key] = "VIEW_AND_UPDATE";
        }
      }

      await db.insert(permissionTypes).values([
        {
          companyId: company.id,
          name: "Full Access",
          description: "Complete access to all modules including administration",
          permissions: fullAccess,
          isDefault: false,
        },
        {
          companyId: company.id,
          name: "Standard User",
          description: "Standard operational access without admin functions",
          permissions: standardUser,
          isDefault: true,
        },
        {
          companyId: company.id,
          name: "View Only",
          description: "Read-only access across all modules",
          permissions: viewOnly,
          isDefault: false,
        },
        {
          companyId: company.id,
          name: "Production Team",
          description: "Full production and logistics access with limited admin",
          permissions: productionTeam,
          isDefault: false,
        },
        {
          companyId: company.id,
          name: "Office / Admin",
          description: "Full office, finance, and administration access",
          permissions: officeAdmin,
          isDefault: false,
        },
      ]);
    }
    logger.info("Permission types seeded for all companies");
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    logger.info("User data already exists, skipping user seed...");
    return;
  }

  logger.info("Seeding database with initial data...");

  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const managerPasswordHash = await bcrypt.hash("manager123", 10);
  const userPasswordHash = await bcrypt.hash("user123", 10);

  const [adminUser] = await db.insert(users).values({
    companyId: seedCompanyId,
    email: "admin@buildplus.ai",
    name: "Admin User",
    passwordHash: adminPasswordHash,
    role: "ADMIN",
    isActive: true,
  }).returning();

  const [managerUser] = await db.insert(users).values({
    companyId: seedCompanyId,
    email: "manager@buildplus.ai",
    name: "Sarah Chen",
    passwordHash: managerPasswordHash,
    role: "MANAGER",
    isActive: true,
  }).returning();

  const [drafterUser] = await db.insert(users).values({
    companyId: seedCompanyId,
    email: "drafter@buildplus.ai",
    name: "Michael Torres",
    passwordHash: userPasswordHash,
    role: "USER",
    isActive: true,
  }).returning();

  const [drafter2User] = await db.insert(users).values({
    companyId: seedCompanyId,
    email: "james@buildplus.ai",
    name: "James Wilson",
    passwordHash: userPasswordHash,
    role: "USER",
    isActive: true,
  }).returning();

  const [job1] = await db.insert(jobs).values({
    companyId: seedCompanyId,
    jobNumber: "MCT-2026",
    code: "MCT-2026",
    name: "Melbourne Central Tower Renovation",
    client: "Melbourne Property Group",
    address: "123 Bourke Street, Melbourne VIC 3000",
    status: "ACTIVE",
  }).returning();

  const [job2] = await db.insert(jobs).values({
    companyId: seedCompanyId,
    jobNumber: "SRC-2026",
    code: "SRC-2026",
    name: "Southbank Residential Complex",
    client: "Urban Living Developments",
    address: "45 City Road, Southbank VIC 3006",
    status: "ACTIVE",
  }).returning();

  const [job3] = await db.insert(jobs).values({
    companyId: seedCompanyId,
    jobNumber: "DOF-2026",
    code: "DOF-2026",
    name: "Docklands Office Fitout",
    client: "Docklands Commercial Pty Ltd",
    address: "888 Collins Street, Docklands VIC 3008",
    status: "ACTIVE",
  }).returning();

  await db.insert(globalSettings).values({
    companyId: seedCompanyId,
    tz: "Australia/Melbourne",
    captureIntervalS: 300,
    idleThresholdS: 300,
    trackedApps: "revit,acad",
    requireAddins: true,
  });

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const [log1] = await db.insert(dailyLogs).values({
    userId: drafterUser.id,
    logDay: formatDate(today),
    tz: "Australia/Melbourne",
    discipline: "DRAFTING",
    status: "PENDING",
  }).returning();

  const [log2] = await db.insert(dailyLogs).values({
    userId: drafterUser.id,
    logDay: formatDate(yesterday),
    tz: "Australia/Melbourne",
    discipline: "DRAFTING",
    status: "SUBMITTED",
    submittedAt: new Date(),
  }).returning();

  const [log3] = await db.insert(dailyLogs).values({
    userId: drafter2User.id,
    logDay: formatDate(yesterday),
    tz: "Australia/Melbourne",
    discipline: "DRAFTING",
    status: "SUBMITTED",
    submittedAt: new Date(),
  }).returning();

  const [log4] = await db.insert(dailyLogs).values({
    userId: drafterUser.id,
    logDay: formatDate(twoDaysAgo),
    tz: "Australia/Melbourne",
    discipline: "DRAFTING",
    status: "APPROVED",
    submittedAt: yesterday,
    approvedAt: new Date(),
    approvedBy: managerUser.id,
  }).returning();

  const baseTime = new Date();
  baseTime.setHours(9, 0, 0, 0);

  await db.insert(logRows).values([
    {
      dailyLogId: log1.id,
      jobId: job1.id,
      startAt: new Date(baseTime),
      endAt: new Date(baseTime.getTime() + 45 * 60000),
      durationMin: 45,
      idleMin: 5,
      source: "agent+addins",
      sourceEventId: `seed-${log1.id}-1`,
      tz: "Australia/Melbourne",
      app: "revit",
      filePath: "C:\\Projects\\MCT-2026\\Model\\MCT_Central.rvt",
      fileName: "MCT_Central.rvt",
      revitViewName: "Level 10 - General Arrangement",
      revitSheetNumber: "A101",
      revitSheetName: "General Arrangement - Level 10",
      panelMark: "P-10A",
      drawingCode: "GA-101",
    },
    {
      dailyLogId: log1.id,
      jobId: job1.id,
      startAt: new Date(baseTime.getTime() + 45 * 60000),
      endAt: new Date(baseTime.getTime() + 120 * 60000),
      durationMin: 75,
      idleMin: 10,
      source: "agent+addins",
      sourceEventId: `seed-${log1.id}-2`,
      tz: "Australia/Melbourne",
      app: "revit",
      filePath: "C:\\Projects\\MCT-2026\\Model\\MCT_Central.rvt",
      fileName: "MCT_Central.rvt",
      revitViewName: "Level 11 - General Arrangement",
      revitSheetNumber: "A102",
      revitSheetName: "General Arrangement - Level 11",
      panelMark: "P-11A",
      drawingCode: "GA-102",
    },
    {
      dailyLogId: log1.id,
      jobId: job2.id,
      startAt: new Date(baseTime.getTime() + 135 * 60000),
      endAt: new Date(baseTime.getTime() + 195 * 60000),
      durationMin: 60,
      idleMin: 8,
      source: "agent+addins",
      sourceEventId: `seed-${log1.id}-3`,
      tz: "Australia/Melbourne",
      app: "acad",
      filePath: "C:\\Projects\\SRC-2026\\Drawings\\SRC_Details.dwg",
      fileName: "SRC_Details.dwg",
      acadLayoutName: "Detail-001",
      panelMark: "D-01",
      drawingCode: "DET-001",
    },
  ]);

  await db.insert(logRows).values([
    {
      dailyLogId: log2.id,
      jobId: job1.id,
      startAt: new Date(baseTime),
      endAt: new Date(baseTime.getTime() + 90 * 60000),
      durationMin: 90,
      idleMin: 12,
      source: "agent+addins",
      sourceEventId: `seed-${log2.id}-1`,
      tz: "Australia/Melbourne",
      app: "revit",
      filePath: "C:\\Projects\\MCT-2026\\Model\\MCT_Central.rvt",
      fileName: "MCT_Central.rvt",
      revitViewName: "Level 12 - Floor Plan",
      panelMark: "P-12A",
      drawingCode: "FP-112",
    },
    {
      dailyLogId: log2.id,
      jobId: job3.id,
      startAt: new Date(baseTime.getTime() + 105 * 60000),
      endAt: new Date(baseTime.getTime() + 180 * 60000),
      durationMin: 75,
      idleMin: 5,
      source: "agent+addins",
      sourceEventId: `seed-${log2.id}-2`,
      tz: "Australia/Melbourne",
      app: "acad",
      filePath: "C:\\Projects\\DOF-2026\\Layouts\\DOF_Fitout.dwg",
      fileName: "DOF_Fitout.dwg",
      acadLayoutName: "Layout-A4",
      panelMark: "F-01",
      drawingCode: "FIT-001",
    },
  ]);

  await db.insert(logRows).values([
    {
      dailyLogId: log3.id,
      jobId: job2.id,
      startAt: new Date(baseTime),
      endAt: new Date(baseTime.getTime() + 120 * 60000),
      durationMin: 120,
      idleMin: 15,
      source: "agent+addins",
      sourceEventId: `seed-${log3.id}-1`,
      tz: "Australia/Melbourne",
      app: "revit",
      filePath: "C:\\Projects\\SRC-2026\\Model\\SRC_Residential.rvt",
      fileName: "SRC_Residential.rvt",
      revitViewName: "Tower A - Level 5",
      revitSheetNumber: "AR-501",
      revitSheetName: "Tower A Floor Plan Level 5",
      panelMark: "TA-05",
      drawingCode: "AR-501",
    },
  ]);

  await db.insert(logRows).values([
    {
      dailyLogId: log4.id,
      jobId: job1.id,
      startAt: new Date(baseTime),
      endAt: new Date(baseTime.getTime() + 180 * 60000),
      durationMin: 180,
      idleMin: 20,
      source: "agent+addins",
      sourceEventId: `seed-${log4.id}-1`,
      tz: "Australia/Melbourne",
      app: "revit",
      filePath: "C:\\Projects\\MCT-2026\\Model\\MCT_Central.rvt",
      fileName: "MCT_Central.rvt",
      revitViewName: "Basement - Structure",
      panelMark: "B-01",
      drawingCode: "STR-001",
    },
  ]);

  logger.info("Seed data created successfully!");
  logger.info("Demo accounts: Admin: admin@buildplus.ai / admin123, Manager: manager@buildplus.ai / manager123, User: drafter@buildplus.ai / user123");
}

const PRE_POUR_SECTIONS = [
  {
    id: "formwork",
    title: "Formwork & Mould Preparation",
    fields: [
      { id: "mould_clean", type: "yes_no", label: "Mould clean and free of debris", required: true },
      { id: "mould_oiled", type: "yes_no", label: "Mould properly oiled/release agent applied", required: true },
      { id: "edge_forms", type: "yes_no", label: "Edge forms secure and aligned", required: true },
      { id: "dimensions_checked", type: "yes_no", label: "Panel dimensions verified against drawing", required: true },
      { id: "formwork_notes", type: "textarea", label: "Formwork Notes" },
    ],
  },
  {
    id: "reinforcement",
    title: "Reinforcement Check",
    fields: [
      { id: "reo_type_correct", type: "yes_no", label: "Reinforcement type matches specification", required: true },
      { id: "reo_spacing", type: "yes_no", label: "Bar spacing correct per drawing", required: true },
      { id: "reo_cover", type: "yes_no", label: "Adequate concrete cover maintained", required: true },
      { id: "reo_tied", type: "yes_no", label: "Reinforcement securely tied and supported", required: true },
      { id: "reo_chairs", type: "yes_no", label: "Bar chairs/spacers in position", required: true },
      { id: "reo_notes", type: "textarea", label: "Reinforcement Notes" },
    ],
  },
  {
    id: "embeds",
    title: "Embeds & Inserts",
    fields: [
      { id: "lifters_position", type: "yes_no", label: "Lifting anchors correctly positioned", required: true },
      { id: "lifters_type", type: "yes_no", label: "Lifter type and capacity correct", required: true },
      { id: "dowels_position", type: "yes_no", label: "Dowels correctly placed", required: true },
      { id: "plates_position", type: "yes_no", label: "Cast-in plates/brackets in position", required: true },
      { id: "inserts_position", type: "yes_no", label: "Inserts and ferrules correctly located", required: true },
      { id: "embeds_notes", type: "textarea", label: "Embeds Notes" },
    ],
  },
  {
    id: "pre_pour_defects",
    title: "Defect Assessment",
    fields: [
      { id: "defects_found", type: "yes_no", label: "Any defects or issues identified?" },
      { id: "defect_type", type: "select", label: "Defect Type", options: ["Formwork damage", "Reinforcement misplacement", "Missing embed", "Dimension error", "Contamination", "Other"], dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_severity", type: "select", label: "Severity", options: ["Minor", "Major", "Critical"], dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_location", type: "text", label: "Defect Location", dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_description", type: "textarea", label: "Defect Description", dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_action", type: "select", label: "Corrective Action", options: ["Rectify before pour", "Accept with note", "Reject - rework required", "Hold for engineer review"], dependsOn: "defects_found", dependsOnValue: "yes" },
    ],
  },
  {
    id: "pre_pour_signoff",
    title: "Pre-Pour Sign-off",
    fields: [
      { id: "ready_to_pour", type: "select", label: "Overall Assessment", options: ["Pass - Ready to pour", "Conditional pass - Minor items noted", "Fail - Rework required", "Hold - Engineer review needed"], required: true },
      { id: "inspector_comments", type: "textarea", label: "Inspector Comments" },
    ],
  },
];

const POST_POUR_SECTIONS = [
  {
    id: "surface_finish",
    title: "Surface Finish Inspection",
    fields: [
      { id: "surface_smooth", type: "yes_no", label: "Surface finish acceptable (smooth, even)", required: true },
      { id: "no_honeycombing", type: "yes_no", label: "No honeycombing present", required: true },
      { id: "no_cracking", type: "yes_no", label: "No visible cracking", required: true },
      { id: "no_blowouts", type: "yes_no", label: "No edge blowouts or spalling", required: true },
      { id: "colour_consistent", type: "yes_no", label: "Colour consistency acceptable", required: true },
      { id: "surface_notes", type: "textarea", label: "Surface Notes" },
    ],
  },
  {
    id: "dimensional",
    title: "Dimensional Check",
    fields: [
      { id: "length_within_tol", type: "yes_no", label: "Length within tolerance", required: true },
      { id: "width_within_tol", type: "yes_no", label: "Width within tolerance", required: true },
      { id: "thickness_within_tol", type: "yes_no", label: "Thickness within tolerance", required: true },
      { id: "camber_acceptable", type: "yes_no", label: "Camber/bow within limits", required: true },
      { id: "squareness_ok", type: "yes_no", label: "Squareness checked and acceptable", required: true },
      { id: "dimensional_notes", type: "textarea", label: "Dimensional Notes" },
    ],
  },
  {
    id: "lifting_points",
    title: "Lifting Points & Hardware",
    fields: [
      { id: "lifters_accessible", type: "yes_no", label: "Lifting points accessible and undamaged", required: true },
      { id: "lifters_threads_clear", type: "yes_no", label: "Lifter threads clear (no concrete blockage)", required: true },
      { id: "cast_in_items", type: "yes_no", label: "All cast-in items visible and correctly positioned", required: true },
      { id: "ferrules_clear", type: "yes_no", label: "Ferrules/inserts clear and functional", required: true },
      { id: "lifting_notes", type: "textarea", label: "Lifting Points Notes" },
    ],
  },
  {
    id: "post_pour_defects",
    title: "Defect Assessment",
    fields: [
      { id: "defects_found", type: "yes_no", label: "Any defects or issues identified?" },
      { id: "defect_type", type: "select", label: "Defect Type", options: ["Honeycombing", "Cracking", "Edge damage", "Surface blemish", "Dimensional variance", "Lifting point damage", "Colour variation", "Other"], dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_severity", type: "select", label: "Severity", options: ["Minor - cosmetic only", "Major - requires repair", "Critical - structural concern"], dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_location", type: "text", label: "Defect Location", dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_description", type: "textarea", label: "Defect Description", dependsOn: "defects_found", dependsOnValue: "yes" },
      { id: "defect_action", type: "select", label: "Corrective Action", options: ["Accept as-is", "Patch/repair on site", "Return to factory for repair", "Reject - replace panel", "Hold for engineer review"], dependsOn: "defects_found", dependsOnValue: "yes" },
    ],
  },
  {
    id: "post_pour_signoff",
    title: "Post-Pour Sign-off",
    fields: [
      { id: "overall_result", type: "select", label: "Overall Assessment", options: ["Pass - Panel approved", "Conditional pass - Repairs noted", "Fail - Rework/replacement required", "Hold - Engineer review needed"], required: true },
      { id: "inspector_comments", type: "textarea", label: "Inspector Comments" },
    ],
  },
];

const EQUIPMENT_MAINTENANCE_SECTIONS = [
  {
    id: "sec-maint-1",
    name: "Asset & Service Details",
    order: 0,
    description: "Equipment identification and service information",
    allowRepeats: false,
    items: [
      { id: "mf-1", name: "Asset Name", type: "text_field", required: true, placeholder: "Auto-populated from asset register", description: "Name of the equipment being serviced" },
      { id: "mf-2a", name: "Asset Tag", type: "text_field", required: false, placeholder: "Asset tag number", description: "Asset tag / identifier" },
      { id: "mf-2b", name: "Asset Category", type: "text_field", required: false, placeholder: "e.g., Crane, Forklift, Generator", description: "Equipment category" },
      { id: "mf-2c", name: "Asset Location", type: "text_field", required: false, placeholder: "Current location of the asset", description: "Where the asset is currently located" },
      { id: "mf-3", name: "Serial Number", type: "text_field", required: false, placeholder: "Enter equipment serial number" },
      { id: "mf-4", name: "Service Date & Time", type: "datetime_field", required: true, description: "When is/was the service performed?" },
      { id: "mf-5", name: "Assigned Technician", type: "staff_assignment", required: false, description: "Who performed or will perform the maintenance?" },
      { id: "mf-6", name: "Service Priority", type: "priority_level", required: true, description: "How urgent is this service request?" },
      { id: "mf-6a", name: "Service Type", type: "dropdown", required: true, options: [{ text: "Scheduled Service", value: "scheduled" }, { text: "Breakdown Repair", value: "breakdown" }, { text: "Preventive Maintenance", value: "preventive" }, { text: "Safety Inspection", value: "safety_inspection" }, { text: "Warranty Claim", value: "warranty" }, { text: "Other", value: "other" }], description: "Type of service being performed" },
      { id: "mf-6b", name: "Issue Description", type: "textarea", required: true, placeholder: "Describe the fault, issue, or reason for service request", description: "Detailed description of the problem or service required" },
    ],
  },
  {
    id: "sec-maint-1b",
    name: "Pre-Service Photos",
    order: 1,
    description: "Photographic evidence of the equipment condition before service",
    allowRepeats: false,
    items: [
      { id: "mf-photos-before", name: "Before Service Photos", type: "multi_photo", required: false, description: "Take multiple photos showing the current condition and any visible damage or issues" },
    ],
  },
  {
    id: "sec-maint-2",
    name: "Inspection & Checks",
    order: 2,
    description: "Systematic equipment inspection checklist",
    allowRepeats: false,
    items: [
      { id: "mf-7", name: "Structural Integrity", type: "inspection_check", required: false, description: "Check for cracks, corrosion, or structural damage" },
      { id: "mf-8", name: "Hydraulic System", type: "condition_option", required: false, description: "Condition of hydraulic lines and fluid levels" },
      { id: "mf-9", name: "Electrical System", type: "pass_fail_flag", required: false, description: "Electrical connections, wiring, and controls" },
      { id: "mf-10", name: "Safety Devices", type: "yes_no_na", required: false, description: "Are all safety devices operational?" },
      { id: "mf-11", name: "Lubrication Points Serviced", type: "checkbox", required: false, options: [{ text: "Main Bearing", value: "main_bearing" }, { text: "Gearbox", value: "gearbox" }, { text: "Pivot Points", value: "pivot_points" }, { text: "Track/Wheels", value: "track_wheels" }, { text: "Wire Rope", value: "wire_rope" }] },
      { id: "mf-12", name: "Operating Hours", type: "number_field", required: false, min: 0, placeholder: "Current hour meter reading" },
      { id: "mf-13", name: "Overall Equipment Rating", type: "rating_scale", required: false, min: 1, max: 5, description: "Rate overall equipment condition 1-5" },
    ],
  },
  {
    id: "sec-maint-3",
    name: "Parts & Costs",
    order: 3,
    description: "Track replacement parts and service costs",
    allowRepeats: true,
    items: [
      { id: "mf-14", name: "Parts Supplier", type: "supplier_selector", required: false, description: "Select parts supplier" },
      { id: "mf-15", name: "Parts Description", type: "textarea", required: false, placeholder: "Describe replacement parts used" },
      { id: "mf-16", name: "Parts Cost", type: "amount_field", required: false, description: "Total cost of replacement parts" },
      { id: "mf-17", name: "Labour Cost", type: "amount_field", required: false, description: "Total labour cost for maintenance" },
    ],
  },
  {
    id: "sec-maint-4",
    name: "Post-Service & Sign-off",
    order: 4,
    description: "Post-service documentation, photos, and sign-off",
    allowRepeats: false,
    items: [
      { id: "mf-photos-after", name: "After Service Photos", type: "multi_photo", required: false, description: "Take multiple photos of equipment after service/repair is completed" },
      { id: "mf-20", name: "Service Report", type: "file_upload", required: false, description: "Upload the maintenance service report document" },
      { id: "mf-work-summary", name: "Work Performed Summary", type: "textarea", required: false, placeholder: "Summarise the work that was performed", description: "Summary of all work completed during service" },
      { id: "mf-21", name: "Recommended Next Service", type: "date_field", required: false, description: "Recommended date for next scheduled service" },
      { id: "mf-22", name: "Work Complete Percentage", type: "percentage_field", required: false, min: 0, max: 100, description: "How much of the planned maintenance was completed?" },
      { id: "mf-23", name: "Return to Service Approved", type: "pass_fail_flag", required: true, description: "Is the equipment approved for return to service?" },
      { id: "mf-24", name: "Technician Signature", type: "signature_field", required: true, description: "Technician sign-off confirming work completed" },
    ],
  },
];

export const SYSTEM_MODULES = [
  { code: "PANELS", name: "Panels", description: "Panel quality inspection module", icon: "Layers", color: "#3B82F6" },
  { code: "DOCUMENTS", name: "Documents", description: "Document management module", icon: "FileText", color: "#8B5CF6" },
  { code: "EQUIPMENT", name: "Equipment", description: "Equipment maintenance module", icon: "Wrench", color: "#F59E0B" },
] as const;

export async function ensureSystemChecklistModules() {
  try {
    const allCompanies = await db.select({ id: companies.id }).from(companies);
    
    for (const company of allCompanies) {
      for (const mod of SYSTEM_MODULES) {
        const existing = await db.select().from(entityTypes)
          .where(and(
            eq(entityTypes.companyId, company.id),
            eq(entityTypes.code, mod.code),
            eq(entityTypes.isSystem, true)
          ));

        let entityTypeId: string;

        if (existing.length === 0) {
          const [created] = await db.insert(entityTypes).values({
            companyId: company.id,
            name: mod.name,
            code: mod.code,
            description: mod.description,
            icon: mod.icon,
            color: mod.color,
            isSystem: true,
            isActive: true,
            sortOrder: mod.code === "PANELS" ? 0 : 1,
          }).returning();
          entityTypeId = created.id;
          logger.info(`Created system module: ${mod.name} for company ${company.id}`);
        } else {
          entityTypeId = existing[0].id;
        }

        if (mod.code === "EQUIPMENT") {
          const allExistingMaintenanceTemplates = await db.select().from(checklistTemplates)
            .where(and(
              eq(checklistTemplates.companyId, company.id),
              eq(checklistTemplates.name, "Equipment Maintenance Log"),
            ));

          if (allExistingMaintenanceTemplates.length > 0) {
            for (const tmpl of allExistingMaintenanceTemplates) {
              const updates: Record<string, any> = {
                isSystem: true,
                sections: EQUIPMENT_MAINTENANCE_SECTIONS as any,
                description: "Standard service and repair checklist for equipment maintenance. Used for logging service requests, inspections, parts tracking, and sign-off from the Asset Register.",
              };
              if (tmpl.entityTypeId !== entityTypeId) {
                updates.entityTypeId = entityTypeId;
              }
              await db.update(checklistTemplates)
                .set(updates)
                .where(eq(checklistTemplates.id, tmpl.id));
              if (!tmpl.isSystem || tmpl.entityTypeId !== entityTypeId) {
                logger.info(`Upgraded Equipment Maintenance Log template ${tmpl.id} for company ${company.id}`);
              }
            }

            if (allExistingMaintenanceTemplates.length > 1) {
              const keepId = allExistingMaintenanceTemplates[0].id;
              for (let i = 1; i < allExistingMaintenanceTemplates.length; i++) {
                const dupId = allExistingMaintenanceTemplates[i].id;
                const [hasInstances] = await db.select({ count: sql`count(*)` })
                  .from(checklistInstances)
                  .where(eq(checklistInstances.templateId, dupId));
                if (Number(hasInstances?.count) === 0) {
                  await db.delete(checklistTemplates).where(eq(checklistTemplates.id, dupId));
                  logger.info(`Removed duplicate Equipment Maintenance Log template ${dupId} for company ${company.id}`);
                }
              }
            }
          } else {
            await db.insert(checklistTemplates).values({
              companyId: company.id,
              name: "Equipment Maintenance Log",
              description: "Standard service and repair checklist for equipment maintenance. Used for logging service requests, inspections, parts tracking, and sign-off from the Asset Register.",
              entityTypeId,
              sections: EQUIPMENT_MAINTENANCE_SECTIONS as any,
              isSystem: true,
              isActive: true,
            });
            logger.info(`Created Equipment Maintenance Log template for company ${company.id}`);
          }
        }

        if (mod.code === "PANELS") {
          const existingSubtypes = await db.select().from(entitySubtypes)
            .where(and(
              eq(entitySubtypes.entityTypeId, entityTypeId),
              eq(entitySubtypes.companyId, company.id!)
            ));

          const subtypeMap: Record<string, string> = {};
          for (const st of existingSubtypes) {
            subtypeMap[st.code] = st.id;
          }

          if (!subtypeMap["PRE_POUR"]) {
            const [prePour] = await db.insert(entitySubtypes).values({
              companyId: company.id,
              entityTypeId,
              name: "Pre-Pour Inspection",
              code: "PRE_POUR",
              description: "Inspection before concrete pour",
              sortOrder: 0,
              isActive: true,
            }).returning();
            subtypeMap["PRE_POUR"] = prePour.id;
          }

          if (!subtypeMap["POST_POUR"]) {
            const [postPour] = await db.insert(entitySubtypes).values({
              companyId: company.id,
              entityTypeId,
              name: "Post-Pour Inspection",
              code: "POST_POUR",
              description: "Inspection after concrete pour and stripping",
              sortOrder: 1,
              isActive: true,
            }).returning();
            subtypeMap["POST_POUR"] = postPour.id;
          }

          const existingTemplates = await db.select().from(checklistTemplates)
            .where(and(
              eq(checklistTemplates.companyId, company.id),
              eq(checklistTemplates.entityTypeId, entityTypeId),
              eq(checklistTemplates.isSystem, true)
            ));

          const templateCodes = existingTemplates.map(t => t.name);

          if (!templateCodes.includes("Pre-Pour Quality Inspection")) {
            await db.insert(checklistTemplates).values({
              companyId: company.id,
              name: "Pre-Pour Quality Inspection",
              description: "Quality inspection checklist to be completed before concrete pour. Covers formwork, reinforcement, embeds, and defect assessment.",
              entityTypeId,
              entitySubtypeId: subtypeMap["PRE_POUR"],
              sections: PRE_POUR_SECTIONS as any,
              isSystem: true,
              isActive: true,
            });
            logger.info(`Created Pre-Pour template for company ${company.id}`);
          }

          if (!templateCodes.includes("Post-Pour Quality Inspection")) {
            await db.insert(checklistTemplates).values({
              companyId: company.id,
              name: "Post-Pour Quality Inspection",
              description: "Quality inspection checklist after stripping. Covers surface finish, dimensions, lifting points, and defect assessment.",
              entityTypeId,
              entitySubtypeId: subtypeMap["POST_POUR"],
              sections: POST_POUR_SECTIONS as any,
              isSystem: true,
              isActive: true,
            });
            logger.info(`Created Post-Pour template for company ${company.id}`);
          }
        }
      }
    }
    logger.info("System checklist modules verified");
  } catch (error) {
    logger.error({ err: error }, "Failed to ensure system checklist modules");
  }
}
