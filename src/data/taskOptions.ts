/**
 * Ажлын даалгаврын тогтмолууд — сервер (шалгалт) ба клиент (UI) хоёул эндээс
 * уншина. Түлхүүр нь баазад бичигдэх утга тул шошгыг өөрчлөхөд өгөгдөл
 * хөндөгдөхгүй.
 */

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

/** Канбан самбарын багануудын дараалал */
export const taskStatuses: TaskStatus[] = ["todo", "in_progress", "done"];

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "Хүлээгдэж буй",
  in_progress: "Хийгдэж байна",
  done: "Дууссан",
};

export const taskPriorities: TaskPriority[] = ["low", "normal", "high"];

export const taskPriorityLabels: Record<TaskPriority, string> = {
  low: "Сул",
  normal: "Энгийн",
  high: "Яаралтай",
};

export const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === "string" && taskStatuses.includes(value as TaskStatus);

export const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === "string" && taskPriorities.includes(value as TaskPriority);
