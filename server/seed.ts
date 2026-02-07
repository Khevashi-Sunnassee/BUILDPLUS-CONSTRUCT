import { db } from "./db";
import { users, jobs, dailyLogs, logRows, globalSettings, workTypes, trailerTypes, entityTypes, entitySubtypes, checklistTemplates, companies } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import logger from "./lib/logger";

export async function seedDatabase() {
  logger.info("Checking if seed data exists...");

  // Always seed work types (idempotent)
  const existingWorkTypes = await db.select().from(workTypes);
  if (existingWorkTypes.length === 0) {
    await db.insert(workTypes).values([
      {
        code: "GENERAL",
        name: "General Drafting",
        description: "Standard drafting work",
        sortOrder: 1,
        isActive: true,
      },
      {
        code: "CLIENT_CHANGE",
        name: "Client Changes",
        description: "Modifications requested by client",
        sortOrder: 2,
        isActive: true,
      },
      {
        code: "ERROR_REWORK",
        name: "Errors/Redrafting",
        description: "Corrections and redrafting of previous work",
        sortOrder: 3,
        isActive: true,
      },
    ]);
    logger.info("Work types seeded");
  }

  // Always seed trailer types (idempotent)
  const existingTrailerTypes = await db.select().from(trailerTypes);
  if (existingTrailerTypes.length === 0) {
    await db.insert(trailerTypes).values([
      {
        name: "Layover",
        description: "Flat deck trailer with panels laying flat",
        sortOrder: 1,
        isActive: true,
      },
      {
        name: "A-Frame",
        description: "A-frame trailer with panels standing upright",
        sortOrder: 2,
        isActive: true,
      },
    ]);
    logger.info("Trailer types seeded");
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
    email: "admin@lte.com.au",
    name: "Admin User",
    passwordHash: adminPasswordHash,
    role: "ADMIN",
    isActive: true,
  }).returning();

  const [managerUser] = await db.insert(users).values({
    email: "manager@lte.com.au",
    name: "Sarah Chen",
    passwordHash: managerPasswordHash,
    role: "MANAGER",
    isActive: true,
  }).returning();

  const [drafterUser] = await db.insert(users).values({
    email: "drafter@lte.com.au",
    name: "Michael Torres",
    passwordHash: userPasswordHash,
    role: "USER",
    isActive: true,
  }).returning();

  const [drafter2User] = await db.insert(users).values({
    email: "james@lte.com.au",
    name: "James Wilson",
    passwordHash: userPasswordHash,
    role: "USER",
    isActive: true,
  }).returning();

  const [job1] = await db.insert(jobs).values({
    jobNumber: "MCT-2026",
    code: "MCT-2026",
    name: "Melbourne Central Tower Renovation",
    client: "Melbourne Property Group",
    address: "123 Bourke Street, Melbourne VIC 3000",
    status: "ACTIVE",
  }).returning();

  const [job2] = await db.insert(jobs).values({
    jobNumber: "SRC-2026",
    code: "SRC-2026",
    name: "Southbank Residential Complex",
    client: "Urban Living Developments",
    address: "45 City Road, Southbank VIC 3006",
    status: "ACTIVE",
  }).returning();

  const [job3] = await db.insert(jobs).values({
    jobNumber: "DOF-2026",
    code: "DOF-2026",
    name: "Docklands Office Fitout",
    client: "Docklands Commercial Pty Ltd",
    address: "888 Collins Street, Docklands VIC 3008",
    status: "ACTIVE",
  }).returning();

  await db.insert(globalSettings).values({
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
  logger.info("Demo accounts: Admin: admin@lte.com.au / admin123, Manager: manager@lte.com.au / manager123, User: drafter@lte.com.au / user123");
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

export const SYSTEM_MODULES = [
  { code: "PANELS", name: "Panels", description: "Panel quality inspection module", icon: "Layers", color: "#3B82F6" },
  { code: "DOCUMENTS", name: "Documents", description: "Document management module", icon: "FileText", color: "#8B5CF6" },
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
