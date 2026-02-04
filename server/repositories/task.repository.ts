import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  taskGroups, tasks, taskAssignees, taskUpdates, taskFiles, taskNotifications,
  users, jobs, panelRegister,
  type InsertTaskGroup, type TaskGroup,
  type InsertTask, type Task,
  type InsertTaskAssignee, type TaskAssignee,
  type InsertTaskUpdate, type TaskUpdate,
  type InsertTaskFile, type TaskFile,
  type InsertTaskNotification, type TaskNotification,
  type User, type Job, type PanelRegister
} from "@shared/schema";

export interface TaskWithDetails extends Task {
  assignees?: (TaskAssignee & { user: User })[];
  job?: Job;
  panel?: PanelRegister;
  createdBy?: User;
}

export interface TaskGroupWithTasks extends TaskGroup {
  tasks?: TaskWithDetails[];
}

export class TaskRepository {
  async getAllTaskGroups(): Promise<TaskGroupWithTasks[]> {
    const groups = await db.select().from(taskGroups).orderBy(asc(taskGroups.displayOrder));
    const result: TaskGroupWithTasks[] = [];
    
    for (const group of groups) {
      const groupTasks = await this.getTasksByGroupId(group.id);
      result.push({ ...group, tasks: groupTasks });
    }
    
    return result;
  }

  private async getTasksByGroupId(groupId: string): Promise<TaskWithDetails[]> {
    const groupTasks = await db.select().from(tasks).where(eq(tasks.groupId, groupId)).orderBy(asc(tasks.displayOrder));
    return this.enrichTasks(groupTasks);
  }

  private async enrichTasks(tasksList: Task[]): Promise<TaskWithDetails[]> {
    const result: TaskWithDetails[] = [];
    for (const task of tasksList) {
      const assignees = await this.getTaskAssignees(task.id);
      const [job] = task.jobId ? await db.select().from(jobs).where(eq(jobs.id, task.jobId)) : [];
      const [panel] = task.panelId ? await db.select().from(panelRegister).where(eq(panelRegister.id, task.panelId)) : [];
      const [createdBy] = task.createdById ? await db.select().from(users).where(eq(users.id, task.createdById)) : [];
      result.push({
        ...task,
        assignees,
        job: job || undefined,
        panel: panel || undefined,
        createdBy: createdBy || undefined
      });
    }
    return result;
  }

  async getTaskGroup(id: string): Promise<TaskGroupWithTasks | undefined> {
    const [group] = await db.select().from(taskGroups).where(eq(taskGroups.id, id));
    if (!group) return undefined;
    const groupTasks = await this.getTasksByGroupId(id);
    return { ...group, tasks: groupTasks };
  }

  async createTaskGroup(data: InsertTaskGroup): Promise<TaskGroup> {
    const [group] = await db.insert(taskGroups).values(data).returning();
    return group;
  }

  async updateTaskGroup(id: string, data: Partial<InsertTaskGroup>): Promise<TaskGroup | undefined> {
    const [group] = await db.update(taskGroups).set({ ...data, updatedAt: new Date() }).where(eq(taskGroups.id, id)).returning();
    return group;
  }

  async deleteTaskGroup(id: string): Promise<void> {
    const groupTasks = await db.select().from(tasks).where(eq(tasks.groupId, id));
    for (const task of groupTasks) {
      await this.deleteTask(task.id);
    }
    await db.delete(taskGroups).where(eq(taskGroups.id, id));
  }

  async reorderTaskGroups(groupIds: string[]): Promise<void> {
    for (let i = 0; i < groupIds.length; i++) {
      await db.update(taskGroups).set({ displayOrder: i, updatedAt: new Date() }).where(eq(taskGroups.id, groupIds[i]));
    }
  }

  async getTask(id: string): Promise<TaskWithDetails | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return undefined;
    const enriched = await this.enrichTasks([task]);
    return enriched[0];
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db.update(tasks).set({ ...data, updatedAt: new Date() }).where(eq(tasks.id, id)).returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, id));
    await db.delete(taskUpdates).where(eq(taskUpdates.taskId, id));
    await db.delete(taskFiles).where(eq(taskFiles.taskId, id));
    await db.delete(taskNotifications).where(eq(taskNotifications.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async reorderTasks(groupId: string, taskIds: string[]): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      await db.update(tasks).set({ displayOrder: i, updatedAt: new Date() }).where(eq(tasks.id, taskIds[i]));
    }
  }

  async getTaskAssignees(taskId: string): Promise<(TaskAssignee & { user: User })[]> {
    const assignees = await db.select().from(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    const result: (TaskAssignee & { user: User })[] = [];
    for (const assignee of assignees) {
      const [user] = await db.select().from(users).where(eq(users.id, assignee.userId));
      if (user) result.push({ ...assignee, user });
    }
    return result;
  }

  async setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]> {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    if (userIds.length === 0) return [];
    
    await db.insert(taskAssignees).values(userIds.map(userId => ({ taskId, userId })));
    return this.getTaskAssignees(taskId);
  }

  async getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User })[]> {
    const updates = await db.select().from(taskUpdates).where(eq(taskUpdates.taskId, taskId)).orderBy(desc(taskUpdates.createdAt));
    const result: (TaskUpdate & { user: User })[] = [];
    for (const update of updates) {
      const [user] = await db.select().from(users).where(eq(users.id, update.userId));
      if (user) result.push({ ...update, user });
    }
    return result;
  }

  async createTaskUpdate(data: InsertTaskUpdate): Promise<TaskUpdate> {
    const [update] = await db.insert(taskUpdates).values(data).returning();
    return update;
  }

  async deleteTaskUpdate(id: string): Promise<void> {
    await db.delete(taskUpdates).where(eq(taskUpdates.id, id));
  }

  async getTaskFiles(taskId: string): Promise<(TaskFile & { uploadedBy?: User | null })[]> {
    const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, taskId));
    const result: (TaskFile & { uploadedBy?: User | null })[] = [];
    for (const file of files) {
      const [user] = file.uploadedById ? await db.select().from(users).where(eq(users.id, file.uploadedById)) : [];
      result.push({ ...file, uploadedBy: user || null });
    }
    return result;
  }

  async createTaskFile(data: InsertTaskFile): Promise<TaskFile> {
    const [file] = await db.insert(taskFiles).values(data).returning();
    return file;
  }

  async deleteTaskFile(id: string): Promise<void> {
    await db.delete(taskFiles).where(eq(taskFiles.id, id));
  }

  async getTaskNotifications(userId: string): Promise<any[]> {
    const notifications = await db.select().from(taskNotifications)
      .where(eq(taskNotifications.userId, userId))
      .orderBy(desc(taskNotifications.createdAt));
    
    const result: any[] = [];
    for (const notif of notifications) {
      const [task] = notif.taskId ? await db.select().from(tasks).where(eq(tasks.id, notif.taskId)) : [];
      result.push({ ...notif, task: task || null });
    }
    return result;
  }

  async getUnreadTaskNotificationCount(userId: string): Promise<number> {
    const notifications = await db.select().from(taskNotifications)
      .where(and(eq(taskNotifications.userId, userId), eq(taskNotifications.isRead, false)));
    return notifications.length;
  }

  async markTaskNotificationRead(id: string): Promise<void> {
    await db.update(taskNotifications).set({ isRead: true, readAt: new Date() }).where(eq(taskNotifications.id, id));
  }

  async markAllTaskNotificationsRead(userId: string): Promise<void> {
    await db.update(taskNotifications).set({ isRead: true, readAt: new Date() }).where(eq(taskNotifications.userId, userId));
  }

  async createTaskNotificationsForAssignees(taskId: string, excludeUserId: string, type: string, title: string, body: string | null, updateId: string | null): Promise<void> {
    const assignees = await this.getTaskAssignees(taskId);
    for (const assignee of assignees) {
      if (assignee.userId !== excludeUserId) {
        await db.insert(taskNotifications).values({
          userId: assignee.userId,
          taskId,
          type: type as any,
          title,
          body,
          taskUpdateId: updateId
        });
      }
    }
  }
}

export const taskRepository = new TaskRepository();
