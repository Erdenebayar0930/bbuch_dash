import "server-only";

import { eq } from "drizzle-orm";

import { aimags, isValidOption } from "@/data/profileOptions";
import { isTaskPriority, isTaskStatus } from "@/data/taskOptions";
import { db } from "@/lib/db";
import { projects, users } from "@/lib/db/schema";

import type { TaskPriority, TaskStatus } from "@/data/taskOptions";

const MAX_NAME = 120;
const MAX_TEXT = 2000;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const invalid = (error: string): Parsed<never> => ({ ok: false, error });

/** YYYY-MM-DD эсвэл хоосон */
const isDate = (value: string) =>
  value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);

export type ProjectPatch = {
  name?: string;
  aimag?: string;
  description?: string;
  archived?: boolean;
};

/**
 * Төслийн маягтыг шалгана.
 * `partial: true` үед зөвхөн ирсэн талбарыг — засварт ашиглана.
 */
export function readProject(body: unknown, partial: boolean): Parsed<ProjectPatch> {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: ProjectPatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return invalid("Төслийн нэрийг оруулна уу.");
    if (name.length > MAX_NAME) {
      return invalid(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.name = name;
  }

  if (input.aimag !== undefined) {
    const aimag = typeof input.aimag === "string" ? input.aimag.trim() : "";
    // Аймаг нь тогтсон жагсаалттай; хоосон нь "бусад төсөл" гэсэн үг
    if (!isValidOption(aimags, aimag)) return invalid("Аймаг буруу байна.");
    patch.aimag = aimag;
  }

  if (input.description !== undefined) {
    if (typeof input.description !== "string") {
      return invalid("Тайлбар текст байх ёстой.");
    }
    if (input.description.length > MAX_TEXT) {
      return invalid(`Тайлбар ${MAX_TEXT} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.description = input.description.trim();
  }

  if (input.archived !== undefined) {
    if (typeof input.archived !== "boolean") {
      return invalid("archived нь true/false байна.");
    }
    patch.archived = input.archived;
  }

  return { ok: true, value: patch };
}

export type TaskPatch = {
  projectId?: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string | null;
  dueDate?: string;
};

/**
 * Ажлын даалгаврын маягтыг шалгана.
 *
 * Төсөл ба гүйцэтгэгч үнэхээр байгаа эсэхийг баазаас шалгана — байхгүй бол
 * FK алдаа өгөхийн оронд ойлгомжтой мессеж буцаана.
 */
export async function readTask(
  body: unknown,
  partial: boolean
): Promise<Parsed<TaskPatch>> {
  if (typeof body !== "object" || body === null) {
    return invalid("Өгөгдөл буруу байна.");
  }

  const input = body as Record<string, unknown>;
  const patch: TaskPatch = {};

  if (input.title !== undefined || !partial) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return invalid("Даалгаврын нэрийг оруулна уу.");
    if (title.length > MAX_NAME) {
      return invalid(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.title = title;
  }

  if (input.description !== undefined) {
    if (typeof input.description !== "string") {
      return invalid("Тайлбар текст байх ёстой.");
    }
    if (input.description.length > MAX_TEXT) {
      return invalid(`Тайлбар ${MAX_TEXT} тэмдэгтээс урт байж болохгүй.`);
    }
    patch.description = input.description.trim();
  }

  if (input.status !== undefined) {
    if (!isTaskStatus(input.status)) return invalid("Төлөв буруу байна.");
    patch.status = input.status;
  }

  if (input.priority !== undefined) {
    if (!isTaskPriority(input.priority)) {
      return invalid("Ач холбогдол буруу байна.");
    }
    patch.priority = input.priority;
  }

  if (input.dueDate !== undefined) {
    const dueDate = typeof input.dueDate === "string" ? input.dueDate.trim() : "";
    if (!isDate(dueDate)) return invalid("Дуусах огноо YYYY-MM-DD хэлбэртэй байна.");
    patch.dueDate = dueDate;
  }

  if (input.projectId !== undefined || !partial) {
    const projectId =
      typeof input.projectId === "string" ? input.projectId : "";
    if (!projectId) return invalid("Төслийг сонгоно уу.");

    const [found] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!found) return invalid("Төсөл олдсонгүй.");
    patch.projectId = projectId;
  }

  if (input.assignedTo !== undefined) {
    const value = input.assignedTo;

    if (value === null || value === "") {
      patch.assignedTo = null;
    } else if (typeof value !== "string") {
      return invalid("Гүйцэтгэгч буруу байна.");
    } else {
      const [found] = await db
        .select({ uid: users.uid })
        .from(users)
        .where(eq(users.uid, value))
        .limit(1);

      if (!found) return invalid("Гүйцэтгэгч олдсонгүй.");
      patch.assignedTo = value;
    }
  }

  return { ok: true, value: patch };
}
