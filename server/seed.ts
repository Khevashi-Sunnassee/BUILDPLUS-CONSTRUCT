import { db } from "./db";
import { users, jobs, dailyLogs, logRows, globalSettings, workTypes, trailerTypes } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  console.log("Checking if seed data exists...");

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
    console.log("Work types seeded");
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
    console.log("Trailer types seeded");
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("User data already exists, skipping user seed...");
    return;
  }

  console.log("Seeding database with initial data...");

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

  console.log("Seed data created successfully!");
  console.log("Demo accounts:");
  console.log("  Admin: admin@lte.com.au / admin123");
  console.log("  Manager: manager@lte.com.au / manager123");
  console.log("  User: drafter@lte.com.au / user123");
}
