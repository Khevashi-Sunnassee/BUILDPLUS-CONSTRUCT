import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "./middleware/auth.middleware";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  industrialInstruments,
  onboardingTemplates,
  onboardingTemplateTasks,
  employeeOnboardings,
  employeeOnboardingTasks,
  employeeEmployments,
  insertIndustrialInstrumentSchema,
  insertOnboardingTemplateSchema,
  insertOnboardingTemplateTaskSchema,
  insertEmployeeOnboardingSchema,
  insertEmployeeOnboardingTaskSchema,
} from "@shared/schema";

const router = Router();

// ============== Industrial Instruments ==============

router.get("/api/onboarding/instruments", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const results = await db
      .select()
      .from(industrialInstruments)
      .where(eq(industrialInstruments.companyId, companyId))
      .orderBy(desc(industrialInstruments.createdAt));
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch instruments";
    res.status(500).json({ error: msg });
  }
});

router.post("/api/onboarding/instruments", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const parsed = insertIndustrialInstrumentSchema.safeParse({ ...req.body, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [created] = await db.insert(industrialInstruments).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create instrument";
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/onboarding/instruments/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);
    const existing = await db
      .select()
      .from(industrialInstruments)
      .where(and(eq(industrialInstruments.id, id), eq(industrialInstruments.companyId, companyId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Instrument not found" });
    }
    const updateSchema = insertIndustrialInstrumentSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [updated] = await db
      .update(industrialInstruments)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(industrialInstruments.id, id), eq(industrialInstruments.companyId, companyId)))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update instrument";
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/onboarding/instruments/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);
    const existing = await db
      .select()
      .from(industrialInstruments)
      .where(and(eq(industrialInstruments.id, id), eq(industrialInstruments.companyId, companyId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Instrument not found" });
    }
    const [updated] = await db
      .update(industrialInstruments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(industrialInstruments.id, id), eq(industrialInstruments.companyId, companyId)))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete instrument";
    res.status(500).json({ error: msg });
  }
});

// ============== Onboarding Templates ==============

router.get("/api/onboarding/templates", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const templates = await db
      .select()
      .from(onboardingTemplates)
      .where(eq(onboardingTemplates.companyId, companyId))
      .orderBy(desc(onboardingTemplates.createdAt));

    const templatesWithCounts = await Promise.all(
      templates.map(async (template) => {
        const tasks = await db
          .select()
          .from(onboardingTemplateTasks)
          .where(eq(onboardingTemplateTasks.templateId, template.id));
        return { ...template, taskCount: tasks.length };
      })
    );
    res.json(templatesWithCounts);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch templates";
    res.status(500).json({ error: msg });
  }
});

router.post("/api/onboarding/templates", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const { tasks, ...templateData } = req.body;
    const parsed = insertOnboardingTemplateSchema.safeParse({ ...templateData, companyId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [created] = await db.insert(onboardingTemplates).values(parsed.data).returning();

    let createdTasks: any[] = [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      const taskInserts = tasks.map((task: any, index: number) => ({
        ...task,
        templateId: created.id,
        sortOrder: task.sortOrder ?? index,
      }));
      const taskSchema = z.array(insertOnboardingTemplateTaskSchema);
      const tasksParsed = taskSchema.safeParse(taskInserts);
      if (!tasksParsed.success) {
        return res.status(400).json({ error: "Task validation failed", details: tasksParsed.error.errors });
      }
      createdTasks = await db.insert(onboardingTemplateTasks).values(tasksParsed.data).returning();
    }
    res.status(201).json({ ...created, tasks: createdTasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create template";
    res.status(500).json({ error: msg });
  }
});

router.get("/api/onboarding/templates/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);
    const [template] = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, id), eq(onboardingTemplates.companyId, companyId)));
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const tasks = await db
      .select()
      .from(onboardingTemplateTasks)
      .where(eq(onboardingTemplateTasks.templateId, id))
      .orderBy(onboardingTemplateTasks.sortOrder);
    res.json({ ...template, tasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch template";
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/onboarding/templates/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);
    const existing = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, id), eq(onboardingTemplates.companyId, companyId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    const updateSchema = insertOnboardingTemplateSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [updated] = await db
      .update(onboardingTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(onboardingTemplates.id, id), eq(onboardingTemplates.companyId, companyId)))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update template";
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/onboarding/templates/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const id = String(req.params.id);
    const existing = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, id), eq(onboardingTemplates.companyId, companyId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Template not found" });
    }
    await db.delete(onboardingTemplates).where(and(eq(onboardingTemplates.id, id), eq(onboardingTemplates.companyId, companyId)));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete template";
    res.status(500).json({ error: msg });
  }
});

// ============== Onboarding Template Tasks ==============

router.get("/api/onboarding/templates/:templateId/tasks", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const templateId = String(req.params.templateId);
    const [template] = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.companyId, companyId)));
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const tasks = await db
      .select()
      .from(onboardingTemplateTasks)
      .where(eq(onboardingTemplateTasks.templateId, templateId))
      .orderBy(onboardingTemplateTasks.sortOrder);
    res.json(tasks);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch template tasks";
    res.status(500).json({ error: msg });
  }
});

router.post("/api/onboarding/templates/:templateId/tasks", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const templateId = String(req.params.templateId);
    const [template] = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.companyId, companyId)));
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const parsed = insertOnboardingTemplateTaskSchema.safeParse({ ...req.body, templateId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [created] = await db.insert(onboardingTemplateTasks).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create template task";
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/onboarding/templates/:templateId/tasks/:taskId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const templateId = String(req.params.templateId);
    const taskId = String(req.params.taskId);
    const [template] = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.companyId, companyId)));
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const existing = await db
      .select()
      .from(onboardingTemplateTasks)
      .where(and(eq(onboardingTemplateTasks.id, taskId), eq(onboardingTemplateTasks.templateId, templateId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    const updateSchema = insertOnboardingTemplateTaskSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [updated] = await db
      .update(onboardingTemplateTasks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(onboardingTemplateTasks.id, taskId), eq(onboardingTemplateTasks.templateId, templateId)))
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update template task";
    res.status(500).json({ error: msg });
  }
});

router.delete("/api/onboarding/templates/:templateId/tasks/:taskId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const templateId = String(req.params.templateId);
    const taskId = String(req.params.taskId);
    const [template] = await db
      .select()
      .from(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.companyId, companyId)));
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const existing = await db
      .select()
      .from(onboardingTemplateTasks)
      .where(and(eq(onboardingTemplateTasks.id, taskId), eq(onboardingTemplateTasks.templateId, templateId)));
    if (!existing.length) {
      return res.status(404).json({ error: "Task not found" });
    }
    await db.delete(onboardingTemplateTasks).where(and(eq(onboardingTemplateTasks.id, taskId), eq(onboardingTemplateTasks.templateId, templateId)));
    res.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to delete template task";
    res.status(500).json({ error: msg });
  }
});

// ============== Employee Onboardings ==============

router.get("/api/employees/:employeeId/onboardings", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const employeeId = String(req.params.employeeId);
    const results = await db
      .select()
      .from(employeeOnboardings)
      .where(and(eq(employeeOnboardings.employeeId, employeeId), eq(employeeOnboardings.companyId, companyId)))
      .orderBy(desc(employeeOnboardings.createdAt));
    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch onboardings";
    res.status(500).json({ error: msg });
  }
});

router.post("/api/employees/:employeeId/onboardings", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const employeeId = String(req.params.employeeId);
    const { employmentId, templateId, notes } = req.body;

    const onboardingData = {
      companyId,
      employeeId,
      employmentId,
      templateId: templateId || null,
      status: "not_started" as const,
      notes: notes || null,
    };
    const parsed = insertEmployeeOnboardingSchema.safeParse(onboardingData);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const [employment] = await db
      .select()
      .from(employeeEmployments)
      .where(and(eq(employeeEmployments.id, employmentId), eq(employeeEmployments.companyId, companyId)));
    if (!employment) {
      return res.status(404).json({ error: "Employment not found" });
    }

    const [created] = await db.insert(employeeOnboardings).values(parsed.data).returning();

    let createdTasks: any[] = [];
    if (templateId) {
      const templateTasks = await db
        .select()
        .from(onboardingTemplateTasks)
        .where(eq(onboardingTemplateTasks.templateId, templateId))
        .orderBy(onboardingTemplateTasks.sortOrder);

      if (templateTasks.length > 0) {
        const startDate = new Date(employment.startDate);
        const taskValues = templateTasks.map((tt) => {
          let dueDate: string | null = null;
          if (tt.dueDaysOffset !== null && tt.dueDaysOffset !== undefined) {
            const due = new Date(startDate);
            due.setDate(due.getDate() + tt.dueDaysOffset);
            dueDate = due.toISOString().split("T")[0];
          }
          return {
            onboardingId: created.id,
            templateTaskId: tt.id,
            title: tt.title,
            description: tt.description,
            owner: tt.owner,
            status: "pending" as const,
            dueDate,
            requiresEvidence: tt.requiresEvidence,
            isBlocking: tt.isBlocking,
            sortOrder: tt.sortOrder,
          };
        });

        const taskSchema = z.array(insertEmployeeOnboardingTaskSchema);
        const tasksParsed = taskSchema.safeParse(taskValues);
        if (tasksParsed.success) {
          createdTasks = await db.insert(employeeOnboardingTasks).values(tasksParsed.data).returning();
        }
      }
    }

    res.status(201).json({ ...created, tasks: createdTasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create onboarding";
    res.status(500).json({ error: msg });
  }
});

router.get("/api/employees/:employeeId/onboardings/:id", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const employeeId = String(req.params.employeeId);
    const id = String(req.params.id);
    const [onboarding] = await db
      .select()
      .from(employeeOnboardings)
      .where(
        and(
          eq(employeeOnboardings.id, id),
          eq(employeeOnboardings.employeeId, employeeId),
          eq(employeeOnboardings.companyId, companyId)
        )
      );
    if (!onboarding) {
      return res.status(404).json({ error: "Onboarding not found" });
    }
    const tasks = await db
      .select()
      .from(employeeOnboardingTasks)
      .where(eq(employeeOnboardingTasks.onboardingId, id))
      .orderBy(employeeOnboardingTasks.sortOrder);
    res.json({ ...onboarding, tasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch onboarding";
    res.status(500).json({ error: msg });
  }
});

router.patch("/api/employees/:employeeId/onboardings/:id", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const employeeId = String(req.params.employeeId);
    const id = String(req.params.id);
    const existing = await db
      .select()
      .from(employeeOnboardings)
      .where(
        and(
          eq(employeeOnboardings.id, id),
          eq(employeeOnboardings.employeeId, employeeId),
          eq(employeeOnboardings.companyId, companyId)
        )
      );
    if (!existing.length) {
      return res.status(404).json({ error: "Onboarding not found" });
    }
    const updateSchema = insertEmployeeOnboardingSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const [updated] = await db
      .update(employeeOnboardings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(employeeOnboardings.id, id),
          eq(employeeOnboardings.employeeId, employeeId),
          eq(employeeOnboardings.companyId, companyId)
        )
      )
      .returning();
    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update onboarding";
    res.status(500).json({ error: msg });
  }
});

// ============== Employee Onboarding Tasks ==============

router.patch("/api/employees/:employeeId/onboardings/:onboardingId/tasks/:taskId", requireAuth, requireRole("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const companyId = req.session.companyId!;
    const employeeId = String(req.params.employeeId);
    const onboardingId = String(req.params.onboardingId);
    const taskId = String(req.params.taskId);

    const [onboarding] = await db
      .select()
      .from(employeeOnboardings)
      .where(
        and(
          eq(employeeOnboardings.id, onboardingId),
          eq(employeeOnboardings.employeeId, employeeId),
          eq(employeeOnboardings.companyId, companyId)
        )
      );
    if (!onboarding) {
      return res.status(404).json({ error: "Onboarding not found" });
    }

    const existingTasks = await db
      .select()
      .from(employeeOnboardingTasks)
      .where(and(eq(employeeOnboardingTasks.id, taskId), eq(employeeOnboardingTasks.onboardingId, onboardingId)));
    if (!existingTasks.length) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updateSchema = insertEmployeeOnboardingTaskSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }

    const updateData: Record<string, any> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.status === "complete") {
      updateData.completedAt = new Date();
      updateData.completedBy = req.session.userId;
    }

    const [updated] = await db
      .update(employeeOnboardingTasks)
      .set(updateData)
      .where(and(eq(employeeOnboardingTasks.id, taskId), eq(employeeOnboardingTasks.onboardingId, onboardingId)))
      .returning();

    const allTasks = await db
      .select()
      .from(employeeOnboardingTasks)
      .where(eq(employeeOnboardingTasks.onboardingId, onboardingId));

    const allComplete = allTasks.every((t) => t.status === "complete");
    const anyBlocked = allTasks.some((t) => t.status === "blocked");

    if (allComplete) {
      await db
        .update(employeeOnboardings)
        .set({ status: "complete", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(employeeOnboardings.id, onboardingId));
    } else if (anyBlocked) {
      await db
        .update(employeeOnboardings)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(employeeOnboardings.id, onboardingId));
    }

    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to update onboarding task";
    res.status(500).json({ error: msg });
  }
});

export const onboardingRouter = router;
