import { eq, and, desc, sql, asc, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  taskGroups, tasks, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  users, jobs,
  type TaskGroup, type InsertTaskGroup,
  type Task, type InsertTask,
  type TaskAssignee,
  type TaskUpdate, type InsertTaskUpdate,
  type TaskFile, type InsertTaskFile,
  type User, type Job,
} from "@shared/schema";
import type { TaskWithDetails, TaskGroupWithTasks } from "./types";

async function getTaskWithDetails(taskId: string): Promise<TaskWithDetails | undefined> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return undefined;

  const assigneesResult = await db.select()
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(eq(taskAssignees.taskId, taskId));
  
  const assignees = assigneesResult.map(r => ({
    ...r.task_assignees,
    user: r.users,
  }));

  const subtasksResult = await db.select().from(tasks)
    .where(eq(tasks.parentId, taskId))
    .orderBy(asc(tasks.sortOrder));

  const subtasksWithDetails: TaskWithDetails[] = [];
  for (const subtask of subtasksResult) {
    const subtaskAssigneesResult = await db.select()
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(eq(taskAssignees.taskId, subtask.id));
    
    const subtaskAssignees = subtaskAssigneesResult.map(r => ({
      ...r.task_assignees,
      user: r.users,
    }));

    let subtaskJob: Job | null = null;
    if (subtask.jobId) {
      const [jobResult] = await db.select().from(jobs).where(eq(jobs.id, subtask.jobId));
      subtaskJob = jobResult || null;
    }

    const [subtaskUpdatesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(taskUpdates)
      .where(eq(taskUpdates.taskId, subtask.id));

    const [subtaskFilesCount] = await db.select({ count: sql<number>`count(*)` })
      .from(taskFiles)
      .where(eq(taskFiles.taskId, subtask.id));

    let subtaskCreatedBy: User | null = null;
    if (subtask.createdById) {
      const [creator] = await db.select().from(users).where(eq(users.id, subtask.createdById));
      subtaskCreatedBy = creator || null;
    }

    subtasksWithDetails.push({
      ...subtask,
      assignees: subtaskAssignees,
      subtasks: [],
      updatesCount: Number(subtaskUpdatesCount?.count || 0),
      filesCount: Number(subtaskFilesCount?.count || 0),
      createdBy: subtaskCreatedBy,
      job: subtaskJob,
    });
  }

  const [updatesCount] = await db.select({ count: sql<number>`count(*)` })
    .from(taskUpdates)
    .where(eq(taskUpdates.taskId, taskId));

  const [filesCount] = await db.select({ count: sql<number>`count(*)` })
    .from(taskFiles)
    .where(eq(taskFiles.taskId, taskId));

  let createdBy: User | null = null;
  if (task.createdById) {
    const [creator] = await db.select().from(users).where(eq(users.id, task.createdById));
    createdBy = creator || null;
  }

  let job: Job | null = null;
  if (task.jobId) {
    const [jobResult] = await db.select().from(jobs).where(eq(jobs.id, task.jobId));
    job = jobResult || null;
  }

  return {
    ...task,
    assignees,
    subtasks: subtasksWithDetails,
    updatesCount: Number(updatesCount?.count || 0),
    filesCount: Number(filesCount?.count || 0),
    createdBy,
    job,
  };
}

export const taskMethods = {
  async getAllTaskGroups(companyId?: string, userId?: string): Promise<TaskGroupWithTasks[]> {
    const groups = await db.select().from(taskGroups)
      .where(companyId ? eq(taskGroups.companyId, companyId) : undefined)
      .orderBy(asc(taskGroups.sortOrder));
    
    const result: TaskGroupWithTasks[] = [];
    for (const group of groups) {
      const groupTasks = await db.select().from(tasks)
        .where(and(eq(tasks.groupId, group.id), sql`${tasks.parentId} IS NULL`))
        .orderBy(asc(tasks.sortOrder));

      const tasksWithDetails: TaskWithDetails[] = [];
      for (const task of groupTasks) {
        const taskDetails = await getTaskWithDetails(task.id);
        if (taskDetails) {
          tasksWithDetails.push(taskDetails);
        }
      }

      if (userId) {
        const filtered = tasksWithDetails.filter(task => {
          if (task.createdById === userId) return true;
          if (task.assignees?.some(a => a.userId === userId)) return true;
          return false;
        });
        result.push({ ...group, tasks: filtered });
      } else {
        result.push({ ...group, tasks: tasksWithDetails });
      }
    }

    return result;
  },

  async getTaskGroup(id: string): Promise<TaskGroupWithTasks | undefined> {
    const [group] = await db.select().from(taskGroups).where(eq(taskGroups.id, id));
    if (!group) return undefined;

    const groupTasks = await db.select().from(tasks)
      .where(and(eq(tasks.groupId, id), sql`${tasks.parentId} IS NULL`))
      .orderBy(asc(tasks.sortOrder));

    const tasksWithDetails: TaskWithDetails[] = [];
    for (const task of groupTasks) {
      const taskDetails = await getTaskWithDetails(task.id);
      if (taskDetails) {
        tasksWithDetails.push(taskDetails);
      }
    }

    return {
      ...group,
      tasks: tasksWithDetails,
    };
  },

  async createTaskGroup(data: InsertTaskGroup): Promise<TaskGroup> {
    const [maxOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` }).from(taskGroups);

    let color = data.color;
    if (!color) {
      const GROUP_COLOR_PALETTE = [
        "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
        "#f43f5e", "#ef4444", "#f97316", "#f59e0b", "#eab308",
        "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
        "#0ea5e9", "#3b82f6", "#2563eb", "#7c3aed", "#c026d3",
        "#e11d48", "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
        "#4f46e5", "#9333ea", "#db2777", "#dc2626", "#d97706",
        "#65a30d", "#059669", "#0d9488", "#0284c7", "#1d4ed8",
      ];
      const existingGroups = await db.select({ color: taskGroups.color }).from(taskGroups)
        .where(data.companyId ? eq(taskGroups.companyId, data.companyId) : undefined);
      const usedColors = new Set(existingGroups.map(g => g.color?.toLowerCase()));
      color = GROUP_COLOR_PALETTE.find(c => !usedColors.has(c.toLowerCase())) || GROUP_COLOR_PALETTE[existingGroups.length % GROUP_COLOR_PALETTE.length];
    }

    const [group] = await db.insert(taskGroups).values({
      ...data,
      color,
      sortOrder: (maxOrder?.maxOrder || 0) + 1,
    }).returning();
    return group;
  },

  async updateTaskGroup(id: string, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined> {
    const [group] = await db.update(taskGroups).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(taskGroups.id, id)).returning();
    return group;
  },

  async deleteTaskGroup(id: string): Promise<void> {
    await db.delete(taskGroups).where(eq(taskGroups.id, id));
  },

  async reorderTaskGroups(groupIds: string[]): Promise<void> {
    for (let i = 0; i < groupIds.length; i++) {
      await db.update(taskGroups).set({ sortOrder: i, updatedAt: new Date() }).where(eq(taskGroups.id, groupIds[i]));
    }
  },

  async getTask(id: string): Promise<TaskWithDetails | undefined> {
    return getTaskWithDetails(id);
  },

  async getTasksByActivity(activityId: string, companyId?: string): Promise<TaskWithDetails[]> {
    if (companyId) {
      const activityTasks = await db.select({ t: tasks }).from(tasks)
        .innerJoin(taskGroups, eq(tasks.groupId, taskGroups.id))
        .where(and(
          eq(tasks.jobActivityId, activityId),
          isNull(tasks.parentId),
          eq(taskGroups.companyId, companyId),
        ))
        .orderBy(asc(tasks.sortOrder));

      const result: TaskWithDetails[] = [];
      for (const row of activityTasks) {
        const taskDetails = await getTaskWithDetails(row.t.id);
        if (taskDetails) {
          result.push(taskDetails);
        }
      }
      return result;
    }

    const activityTasks = await db.select().from(tasks)
      .where(and(eq(tasks.jobActivityId, activityId), isNull(tasks.parentId)))
      .orderBy(asc(tasks.sortOrder));

    const result: TaskWithDetails[] = [];
    for (const task of activityTasks) {
      const taskDetails = await getTaskWithDetails(task.id);
      if (taskDetails) {
        result.push(taskDetails);
      }
    }
    return result;
  },

  async createTask(data: InsertTask): Promise<Task> {
    const [maxOrder] = await db.select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(tasks)
      .where(eq(tasks.groupId, data.groupId));
    const [task] = await db.insert(tasks).values({
      ...data,
      sortOrder: (maxOrder?.maxOrder || 0) + 1,
    }).returning();
    return task;
  },

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(tasks.id, id)).returning();
    return task;
  },

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  },

  async reorderTasks(groupId: string, taskIds: string[]): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      await db.update(tasks).set({ sortOrder: i, updatedAt: new Date() }).where(eq(tasks.id, taskIds[i]));
    }
  },

  async moveTaskToGroup(taskId: string, targetGroupId: string, targetIndex: number): Promise<Task | undefined> {
    const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!task.length) return undefined;

    const targetGroupTasks = await db.select()
      .from(tasks)
      .where(and(eq(tasks.groupId, targetGroupId), isNull(tasks.parentId)))
      .orderBy(tasks.sortOrder);

    await db.update(tasks).set({
      groupId: targetGroupId,
      sortOrder: targetIndex,
      updatedAt: new Date(),
    }).where(eq(tasks.id, taskId));

    const tasksToReorder = targetGroupTasks.filter(t => t.id !== taskId);
    let order = 0;
    for (let i = 0; i <= tasksToReorder.length; i++) {
      if (i === targetIndex) {
        order++;
      }
      if (i < tasksToReorder.length) {
        await db.update(tasks).set({ sortOrder: order, updatedAt: new Date() }).where(eq(tasks.id, tasksToReorder[i].id));
        order++;
      }
    }

    const updated = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return updated[0];
  },

  async getTaskAssignees(taskId: string): Promise<(TaskAssignee & { user: User })[]> {
    const result = await db.select()
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(eq(taskAssignees.taskId, taskId));
    
    return result.map(r => ({
      ...r.task_assignees,
      user: r.users,
    }));
  },

  async setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]> {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    
    for (const userId of userIds) {
      await db.insert(taskAssignees).values({ taskId, userId }).onConflictDoNothing();
    }
    
    return taskMethods.getTaskAssignees(taskId);
  },

  async getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User; files?: TaskFile[] })[]> {
    const result = await db.select()
      .from(taskUpdates)
      .innerJoin(users, eq(taskUpdates.userId, users.id))
      .where(eq(taskUpdates.taskId, taskId))
      .orderBy(desc(taskUpdates.createdAt));
    
    const updates = result.map(r => ({
      ...r.task_updates,
      user: r.users,
    }));
    
    const updateIds = updates.map(u => u.id);
    if (updateIds.length > 0) {
      const linkedFiles = await db.select()
        .from(taskFiles)
        .where(inArray(taskFiles.updateId, updateIds));
      
      const filesByUpdateId = new Map<string, TaskFile[]>();
      for (const file of linkedFiles) {
        if (file.updateId) {
          if (!filesByUpdateId.has(file.updateId)) {
            filesByUpdateId.set(file.updateId, []);
          }
          filesByUpdateId.get(file.updateId)!.push(file);
        }
      }
      
      return updates.map(u => ({
        ...u,
        files: filesByUpdateId.get(u.id) || [],
      }));
    }
    
    return updates.map(u => ({ ...u, files: [] }));
  },

  async createTaskUpdate(data: InsertTaskUpdate): Promise<TaskUpdate> {
    const [update] = await db.insert(taskUpdates).values(data).returning();
    return update;
  },

  async getTaskUpdate(id: string): Promise<TaskUpdate | undefined> {
    const [update] = await db.select().from(taskUpdates).where(eq(taskUpdates.id, id)).limit(1);
    return update;
  },

  async deleteTaskUpdate(id: string): Promise<void> {
    await db.delete(taskUpdates).where(eq(taskUpdates.id, id));
  },

  async getTaskFiles(taskId: string): Promise<(TaskFile & { uploadedBy?: User | null })[]> {
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId)).orderBy(desc(taskFiles.createdAt));
    
    if (files.length === 0) return [];
    
    const uploaderIds = [...new Set(files.map(f => f.uploadedById).filter((id): id is string => !!id))];
    const uploaderMap = new Map<string, User>();
    
    if (uploaderIds.length > 0) {
      const uploaders = await db.select().from(users).where(inArray(users.id, uploaderIds));
      for (const user of uploaders) {
        uploaderMap.set(user.id, user);
      }
    }
    
    return files.map(file => ({
      ...file,
      uploadedBy: file.uploadedById ? uploaderMap.get(file.uploadedById) || null : null,
    }));
  },

  async createTaskFile(data: InsertTaskFile): Promise<TaskFile> {
    const [file] = await db.insert(taskFiles).values(data).returning();
    return file;
  },

  async getTaskFile(id: string): Promise<TaskFile | undefined> {
    const [file] = await db.select().from(taskFiles).where(eq(taskFiles.id, id)).limit(1);
    return file;
  },

  async deleteTaskFile(id: string): Promise<void> {
    await db.delete(taskFiles).where(eq(taskFiles.id, id));
  },

  async getTaskNotifications(userId: string): Promise<any[]> {
    const notifications = await db.select().from(taskNotifications)
      .where(eq(taskNotifications.userId, userId))
      .orderBy(desc(taskNotifications.createdAt))
      .limit(50);
    
    if (notifications.length === 0) return [];
    
    const fromUserIds = [...new Set(notifications.map(n => n.fromUserId).filter((id): id is string => !!id))];
    const taskIds = [...new Set(notifications.map(n => n.taskId))];
    
    const [fromUsers, tasksList] = await Promise.all([
      fromUserIds.length > 0 ? db.select().from(users).where(inArray(users.id, fromUserIds)) : Promise.resolve([]),
      taskIds.length > 0 ? db.select().from(tasks).where(inArray(tasks.id, taskIds)) : Promise.resolve([]),
    ]);
    
    const userMap = new Map<string, User>();
    for (const u of fromUsers) userMap.set(u.id, u);
    
    const taskMap = new Map<string, Task>();
    for (const t of tasksList) taskMap.set(t.id, t);
    
    return notifications.map(notif => ({
      ...notif,
      fromUser: notif.fromUserId ? userMap.get(notif.fromUserId) || null : null,
      task: taskMap.get(notif.taskId) || null,
    }));
  },

  async getTaskNotificationById(id: string): Promise<any | null> {
    const [notification] = await db.select().from(taskNotifications)
      .where(eq(taskNotifications.id, id));
    return notification || null;
  },

  async getUnreadTaskNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(taskNotifications)
      .where(and(
        eq(taskNotifications.userId, userId),
        sql`${taskNotifications.readAt} IS NULL`
      ));
    return Number(result[0]?.count || 0);
  },

  async markTaskNotificationRead(id: string): Promise<void> {
    await db.update(taskNotifications)
      .set({ readAt: new Date() })
      .where(eq(taskNotifications.id, id));
  },

  async markAllTaskNotificationsRead(userId: string): Promise<void> {
    await db.update(taskNotifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(taskNotifications.userId, userId),
        sql`${taskNotifications.readAt} IS NULL`
      ));
  },

  async createTaskNotificationsForAssignees(
    taskId: string, 
    excludeUserId: string, 
    type: string, 
    title: string, 
    body: string | null, 
    updateId: string | null
  ): Promise<void> {
    const assignees = await db.select().from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));
    
    const notificationsToInsert = assignees
      .filter(a => a.userId !== excludeUserId)
      .map(assignee => ({
        userId: assignee.userId,
        taskId,
        updateId,
        type: type as typeof taskNotifications.type.enumValues[number],
        title,
        body,
        fromUserId: excludeUserId,
      }));
    
    if (notificationsToInsert.length > 0) {
      await db.insert(taskNotifications).values(notificationsToInsert);
    }
  },
};
