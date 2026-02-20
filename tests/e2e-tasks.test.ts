import { describe, it, expect, beforeAll } from "vitest";
import {
  loginAdmin,
  adminGet,
  adminPost,
  adminPatch,
  adminPut,
  adminDelete,
  getAdminUserId,
  uniqueName,
} from "./e2e-helpers";

let authAvailable = false;
let groupId = "";
let taskId = "";
let subtaskId = "";
let updateId = "";
let userId = "";

describe("E2E: Task Group Management", () => {
  const groupName = uniqueName("TG");

  beforeAll(async () => {
    await loginAdmin();
    const meRes = await adminGet("/api/auth/me");
    authAvailable = meRes.status === 200;
    userId = getAdminUserId();
  });

  it("should create a task group", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/task-groups", {
      name: groupName,
      color: "#3b82f6",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    groupId = data.id;
    expect(data.name).toBe(groupName);
    expect(data.color).toBe("#3b82f6");
  });

  it("should list task groups and find the new one", async () => {
    if (!authAvailable) return;
    const res = await adminGet("/api/task-groups");
    expect(res.status).toBe(200);
    const data = await res.json();
    const found = data.find((g: { id: string }) => g.id === groupId);
    expect(found).toBeDefined();
  });

  it("should update task group name", async () => {
    if (!authAvailable) return;
    const res = await adminPatch(`/api/task-groups/${groupId}`, {
      name: `${groupName}_UPDATED`,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(`${groupName}_UPDATED`);
  });
});

describe("E2E: Task CRUD & Lifecycle", () => {
  const taskTitle = uniqueName("TASK");

  it("should create a task in the group", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/tasks", {
      groupId,
      title: taskTitle,
      status: "NOT_STARTED",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    taskId = data.id;
    expect(data.title).toBe(taskTitle);
    expect(data.status).toBe("NOT_STARTED");
  });

  it("should get individual task by ID", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(taskId);
  });

  it("should update task status to IN_PROGRESS", async () => {
    if (!authAvailable) return;
    const res = await adminPatch(`/api/tasks/${taskId}`, {
      status: "IN_PROGRESS",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("IN_PROGRESS");
  });

  it("should update task status to DONE", async () => {
    if (!authAvailable) return;
    const res = await adminPatch(`/api/tasks/${taskId}`, {
      status: "DONE",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("DONE");
  });
});

describe("E2E: Task Assignees", () => {
  it("should assign a user to the task", async () => {
    if (!authAvailable) return;
    const res = await adminPut(`/api/tasks/${taskId}/assignees`, {
      userIds: [userId],
    });
    expect(res.status).toBe(200);
  });

  it("should list assignees for the task", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/tasks/${taskId}/assignees`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});

describe("E2E: Task Updates (Comments)", () => {
  it("should add an update/comment to the task", async () => {
    if (!authAvailable) return;
    const res = await adminPost(`/api/tasks/${taskId}/updates`, {
      content: "E2E test comment on task",
      type: "COMMENT",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    updateId = data.id;
    expect(data.content).toBe("E2E test comment on task");
  });

  it("should list updates for the task", async () => {
    if (!authAvailable) return;
    const res = await adminGet(`/api/tasks/${taskId}/updates`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("should delete the update", async () => {
    if (!authAvailable) return;
    const res = await adminDelete(`/api/task-updates/${updateId}`);
    expect(res.status).toBe(200);
  });
});

describe("E2E: Nested Tasks (Subtasks)", () => {
  it("should create a subtask under the main task", async () => {
    if (!authAvailable) return;
    const res = await adminPost("/api/tasks", {
      groupId,
      parentId: taskId,
      title: uniqueName("SUBTASK"),
      status: "NOT_STARTED",
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    subtaskId = data.id;
    expect(data.parentId).toBe(taskId);
  });

  it("should complete the subtask", async () => {
    if (!authAvailable) return;
    const res = await adminPatch(`/api/tasks/${subtaskId}`, {
      status: "DONE",
    });
    expect(res.status).toBe(200);
  });

  it("should delete the subtask", async () => {
    if (!authAvailable) return;
    const res = await adminDelete(`/api/tasks/${subtaskId}`);
    expect(res.status).toBe(200);
  });
});

describe("E2E: Task Cleanup", () => {
  it("should delete the main task", async () => {
    if (!authAvailable) return;
    const res = await adminDelete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
  });

  it("should delete the task group", async () => {
    if (!authAvailable) return;
    const res = await adminDelete(`/api/task-groups/${groupId}`);
    expect(res.status).toBe(200);
  });
});
