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

/**
 * Төслийн хамгийн их гүн — үндсэн төсөл 1, түүний дэд төсөл 2 гэх мэт.
 * Хэт гүн мод нь UI-д уншигдахаа болино.
 */
export const MAX_PROJECT_DEPTH = 5;

/**
 * Дэд төслийн харагдах аймгуудыг эхэд нь тааруулна.
 *
 * Эх нь бүх аймагт (хоосон) бол дэд нь дурын. Эх нь хязгаартай бол дэд нь
 * зөвхөн эхийн аймгуудаас сонгоно; юу ч сонгоогүй бол эхийнхтэй адил.
 * Эхэд байхгүй аймаг сонгосон бол `null` — эх нь харагдахгүй аймагт дэд нь
 * харагдвал мод тасарна.
 */
export function fitChildAimags(
  parentAimags: readonly string[],
  requested: readonly string[]
): string[] | null {
  if (parentAimags.length === 0) return [...requested];
  if (requested.some((aimag) => !parentAimags.includes(aimag))) return null;
  return requested.length > 0 ? [...requested] : [...parentAimags];
}
