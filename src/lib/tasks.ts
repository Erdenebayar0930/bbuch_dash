"use client";

import { apiFetch } from "./apiClient";

import type { TaskPriority, TaskStatus } from "@/data/taskOptions";

export type { TaskPriority, TaskStatus };

/** Ажлын даалгаврыг бүлэглэх нэгж */
export type Project = {
  id: string;
  name: string;
  /** Харагдах аймгуудын түлхүүр — хоосон бол бүх аймагт */
  aimags: string[];
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
  aimags: row.aimags ?? [],
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
  /** Төсөл харагдах аймгууд — хоосон бол бүх аймагт */
  projectAimags: string[];
  /** Даалгаврыг эзэмших аймаг, эсвэл "" — төслийн ерөнхий даалгавар */
  aimag: string;
  /** Үүсгэсэн хүний uid — өөрийн даалгавраа устгаж чадна */
  createdBy: string | null;
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
  projectAimags: string[] | null;
  aimag: string | null;
  createdBy: string | null;
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
  projectAimags: row.projectAimags ?? [],
  aimag: row.aimag ?? "",
  createdBy: row.createdBy ?? null,
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
  /** Харагдах аймгууд — хоосон бол бүх аймагт */
  aimags: string[];
  description: string;
};

/** Шинэ төсөл үүсгэнэ (Харуулын аймаг, админ). */
export async function createProject(input: ProjectInput): Promise<Project> {
  const data = await apiFetch<{ project: ProjectRow }>("/api/projects", {
    method: "POST",
    body: input,
  });
  return toProject(data.project);
}

/** Төслийг засна (Харуулын аймаг, админ). */
export async function updateProject(
  id: string,
  patch: Partial<ProjectInput & { archived: boolean }>
): Promise<void> {
  await apiFetch(`/api/projects/${id}`, { method: "PATCH", body: patch });
}

/** Төслийг доторх даалгаврын хамт устгана (Харуулын аймаг, админ). */
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
  /** Эзэмших аймаг, эсвэл "" — ерөнхий (Харуул/админ л) */
  aimag: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** null бол хуваарилаагүй */
  assignedTo: string | null;
  /** YYYY-MM-DD, эсвэл хоосон */
  dueDate: string;
};

/** Шинэ даалгавар үүсгэнэ — тухайн аймгийн гишүүн эсвэл Харуул/админ. */
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

/** Даалгаврыг устгана — үүсгэсэн хүн эсвэл Харуул/админ. */
export async function deleteTask(id: string): Promise<void> {
  await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
}

/** Гүйцэтгэгч сонгох жагсаалтын нэг хүн */
export type PlanPerson = {
  uid: string;
  name: string;
  aimags: string[];
};

/**
 * Гүйцэтгэгч болох хүмүүс — `aimag` заавал тэр аймгийн гишүүд, заагаагүй
 * бол бүх идэвхтэй хэрэглэгч (зөвхөн Харуул/админ).
 */
export async function listPlanPeople(aimag?: string): Promise<PlanPerson[]> {
  const data = await apiFetch<{
    people: {
      uid: string;
      firstName: string | null;
      lastName: string | null;
      aimags: string[] | null;
    }[];
  }>(aimag ? `/api/plan-people?aimag=${encodeURIComponent(aimag)}` : "/api/plan-people");

  return (data.people ?? []).map((person) => ({
    uid: person.uid,
    name:
      [person.firstName, person.lastName].filter(Boolean).join(" ") || "Нэргүй",
    aimags: person.aimags ?? [],
  }));
}
