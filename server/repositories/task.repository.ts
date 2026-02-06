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
    const groups = await db.select().from(taskGroups).orderBy(asc((taskGroups as any).displayOrder));
    const groupIds = groups.map(g => g.id);
    if (!groupIds.length) return groups.map(g => ({ ...g, tasks: [] }));

    const allTasks = await db.select().from(tasks)
      .where(inArray(tasks.groupId, groupIds))
      .orderBy(asc((tasks as any).displayOrder));

    const enrichedTasks = await this.enrichTasksBatch(allTasks);

    const tasksByGroup = new Map<string, TaskWithDetails[]>();
    for (const task of enrichedTasks) {
      const list = tasksByGroup.get(task.groupId) || [];
      list.push(task);
      tasksByGroup.set(task.groupId, list);
    }

    return groups.map(g => ({ ...g, tasks: tasksByGroup.get(g.id) || [] }));
  }

  private async getTasksByGroupId(groupId: string): Promise<TaskWithDetails[]> {
    const groupTasks = await db.select().from(tasks).where(eq(tasks.groupId, groupId)).orderBy(asc((tasks as any).displayOrder));
    return this.enrichTasksBatch(groupTasks);
  }

  private async enrichTasksBatch(tasksList: Task[]): Promise<TaskWithDetails[]> {
    if (!tasksList.length) return [];

    const taskIds = tasksList.map(t => t.id);
    const jobIds = [...new Set(tasksList.filter(t => t.jobId).map(t => t.jobId!))];
    const creatorIds = [...new Set(tasksList.filter(t => t.createdById).map(t => t.createdById!))];
    const panelIds = [...new Set(tasksList.filter(t => (t as any).panelId).map(t => (t as any).panelId!))];

    const allAssignees = await db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, taskIds));
    const assigneeUserIds = [...new Set(allAssignees.map(a => a.userId))];
    const allUserIds = [...new Set([...assigneeUserIds, ...creatorIds])];

    const [allUsers, allJobs, allPanels] = await Promise.all([
      allUserIds.length > 0
        ? db.select().from(users).where(inArray(users.id, allUserIds))
        : Promise.resolve([]),
      jobIds.length > 0
        ? db.select().from(jobs).where(inArray(jobs.id, jobIds))
        : Promise.resolve([]),
      panelIds.length > 0
        ? db.select().from(panelRegister).where(inArray(panelRegister.id, panelIds))
        : Promise.resolve([]),
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const jobMap = new Map(allJobs.map(j => [j.id, j]));
    const panelMap = new Map(allPanels.map(p => [p.id, p]));

    const assigneesByTask = new Map<string, (TaskAssignee & { user: User })[]>();
    for (const a of allAssignees) {
      const user = userMap.get(a.userId);
      if (user) {
        const list = assigneesByTask.get(a.taskId) || [];
        list.push({ ...a, user });
        assigneesByTask.set(a.taskId, list);
      }
    }

    return tasksList.map(task => ({
      ...task,
      assignees: assigneesByTask.get(task.id) || [],
      job: task.jobId ? jobMap.get(task.jobId) : undefined,
      panel: (task as any).panelId ? panelMap.get((task as any).panelId) : undefined,
      createdBy: task.createdById ? userMap.get(task.createdById) : undefined,
    }));
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
    const enriched = await this.enrichTasksBatch([task]);
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
    if (!assignees.length) return [];
    const userIds = [...new Set(assignees.map(a => a.userId))];
    const allUsers = await db.select().from(users).where(inArray(users.id, userIds));
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return assignees
      .filter(a => userMap.has(a.userId))
      .map(a => ({ ...a, user: userMap.get(a.userId)! }));
  }

  async setTaskAssignees(taskId: string, userIds: string[]): Promise<(TaskAssignee & { user: User })[]> {
    await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
    if (userIds.length === 0) return [];
    
    await db.insert(taskAssignees).values(userIds.map(userId => ({ taskId, userId })));
    return this.getTaskAssignees(taskId);
  }

  async getTaskUpdates(taskId: string): Promise<(TaskUpdate & { user: User })[]> {
    const updates = await db.select().from(taskUpdates).where(eq(taskUpdates.taskId, taskId)).orderBy(desc(taskUpdates.createdAt));
    if (!updates.length) return [];
    const userIds = [...new Set(updates.map(u => u.userId))];
    const allUsers = await db.select().from(users).where(inArray(users.id, userIds));
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return updates
      .filter(u => userMap.has(u.userId))
      .map(u => ({ ...u, user: userMap.get(u.userId)! }));
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
    if (!files.length) return [];
    const uploaderIds = [...new Set(files.filter(f => f.uploadedById).map(f => f.uploadedById!))];
    const allUsers = uploaderIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, uploaderIds))
      : [];
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    return files.map(f => ({
      ...f,
      uploadedBy: f.uploadedById ? userMap.get(f.uploadedById) || null : null,
    }));
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
    
    if (!notifications.length) return [];
    const taskIds = [...new Set(notifications.filter(n => n.taskId).map(n => n.taskId!))];
    const allTasks = taskIds.length > 0
      ? await db.select().from(tasks).where(inArray(tasks.id, taskIds))
      : [];
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    return notifications.map(n => ({
      ...n,
      task: n.taskId ? taskMap.get(n.taskId) || null : null,
    }));
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
