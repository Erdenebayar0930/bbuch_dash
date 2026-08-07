"use client";

import { apiFetch } from "./apiClient";

import type { TaskPriority, TaskStatus } from "@/data/taskOptions";

export type { TaskPriority, TaskStatus };

/** Ажлын даалгаврыг бүлэглэх нэгж */
export type Project = {
  id: string;
  name: string;
  /** Аймгийн түлхүүр, эсвэл "" — бусад төсөл */
  aimag: string;
  description: string;
  archived: boolean;
  /** Нийт даалгавар */
  taskCount: number;
  /** Дуусаагүй даалгавар */
  openCount: number;
  createdAt: Date;
};

type ProjectRow = Omit<Project, "createdAt"> & { createdAt: string };

const toProject = (row: ProjectRow): Project => ({
  ...row,
  aimag: row.aimag ?? "",
  description: row.description ?? "",
  archived: row.archived ?? false,
  taskCount: row.taskCount ?? 0,
  openCount: row.openCount ?? 0,
  createdAt: new Date(row.createdAt),
});

export type Task = {
  id: string;
  projectId: string;
  projectName: string;
  projectAimag: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** null бол хараахан хуваарилаагүй */
  assignedTo: string | null;
  /** Гүйцэтгэгчийн харагдах нэр — хуваарилаагүй бол хоосон */
  assigneeName: string;
  assigneePhotoUrl: string;
  /** YYYY-MM-DD, эсвэл хоосон */
  dueDate: string;
  position: number;
  completedAt: Date | null;
  createdAt: Date;
};

type TaskRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectAimag: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
  assigneePhotoUrl: string | null;
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  createdAt: string;
};

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  projectId: row.projectId,
  projectName: row.projectName,
  projectAimag: row.projectAimag ?? "",
  title: row.title,
  description: row.description ?? "",
  status: row.status as TaskStatus,
  priority: row.priority as TaskPriority,
  assignedTo: row.assignedTo,
  assigneeName:
    [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(" ") ||
    "",
  assigneePhotoUrl: row.assigneePhotoUrl ?? "",
  dueDate: row.dueDate ?? "",
  position: row.position ?? 0,
  completedAt: row.completedAt ? new Date(row.completedAt) : null,
  createdAt: new Date(row.createdAt),
});

/** Бүх төсөл — даалгаврын тоотой. */
export async function listProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: ProjectRow[] }>("/api/projects");
  return (data.projects ?? []).map(toProject);
}

export type ProjectInput = {
  name: string;
  /** Аймгийн түлхүүр, эсвэл "" */
  aimag: string;
  description: string;
};

/** Шинэ төсөл үүсгэнэ (зөвхөн админ). */
export async function createProject(input: ProjectInput): Promise<Project> {
  const data = await apiFetch<{ project: ProjectRow }>("/api/projects", {
    method: "POST",
    body: input,
  });
  return toProject(data.project);
}

/** Төслийг засна (зөвхөн админ). */
export async function updateProject(
  id: string,
  patch: Partial<ProjectInput & { archived: boolean }>
): Promise<void> {
  await apiFetch(`/api/projects/${id}`, { method: "PATCH", body: patch });
}

/** Төслийг доторх даалгаврын хамт устгана (зөвхөн админ). */
export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
}

/** Даалгаврууд — төслөөр эсвэл зөвхөн өөрт оногдсоноор шүүнэ. */
export async function listTasks(
  filter: { projectId?: string; mine?: boolean } = {}
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter.projectId) params.set("projectId", filter.projectId);
  if (filter.mine) params.set("mine", "1");

  const query = params.toString();
  const data = await apiFetch<{ tasks: TaskRow[] }>(
    query ? `/api/tasks?${query}` : "/api/tasks"
  );

  return (data.tasks ?? []).map(toTask);
}

export type TaskInput = {
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** null бол хуваарилаагүй */
  assignedTo: string | null;
  /** YYYY-MM-DD, эсвэл хоосон */
  dueDate: string;
};

/** Шинэ даалгавар үүсгэнэ (зөвхөн админ). */
export async function createTask(input: TaskInput): Promise<Task> {
  const data = await apiFetch<{ task: TaskRow }>("/api/tasks", {
    method: "POST",
    body: input,
  });
  return toTask(data.task);
}

/**
 * Даалгаврыг засна.
 * Гүйцэтгэгч зөвхөн `status`-ыг өөрчилж чадна — бусдыг сервер няцаана.
 */
export async function updateTask(
  id: string,
  patch: Partial<TaskInput>
): Promise<Task> {
  const data = await apiFetch<{ task: TaskRow }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return toTask(data.task);
}

/** Даалгаврыг устгана (зөвхөн админ). */
export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
}
