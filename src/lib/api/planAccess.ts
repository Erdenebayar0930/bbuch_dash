import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, tasks, users } from "@/lib/db/schema";
import {
  canManageProjects,
  canSeeAllPlans,
  canWorkInAimag,
  projectVisibleToAimag,
} from "@/lib/permissions";

import type { UserRow } from "@/lib/db/schema";

/**
 * Төлөвлөгөөний (төсөл, даалгавар) харагдах дүрэм — нэг л газар.
 *
 * • Харуулын аймаг ба админ: бүгдийг.
 * • Бусад: өөрийн аймагт харагдах төсөл (`aimags` хоосон = бүх аймагт), тэр
 *   дотроос өөрийн аймгийн болон ерөнхий ("") даалгавар.
 */

/** Төслийн шүүлт. `undefined` = хязгааргүй. */
export function projectVisibility(user: UserRow | null) {
  const myAimags = user?.aimags ?? [];
  if (canSeeAllPlans(user?.role, myAimags)) return undefined;

  return or(
    sql`jsonb_array_length(${projects.aimags}) = 0`,
    ...myAimags.map(
      (aimag) => sql`${projects.aimags} @> ${JSON.stringify([aimag])}::jsonb`
    )
  );
}

/** Даалгаврын шүүлт (projects-тэй join хийсэн query-д). */
export function taskVisibility(user: UserRow | null) {
  const myAimags = user?.aimags ?? [];
  if (canSeeAllPlans(user?.role, myAimags)) return undefined;

  return and(
    projectVisibility(user),
    myAimags.length > 0
      ? or(eq(tasks.aimag, ""), inArray(tasks.aimag, myAimags))
      : eq(tasks.aimag, "")
  );
}

/** Даалгаврын жагсаалтын багана — tasks GET/POST/PATCH бүгд ашиглана */
export const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  projectName: projects.name,
  projectAimags: projects.aimags,
  aimag: tasks.aimag,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  assignedTo: tasks.assignedTo,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneePhotoUrl: users.photoUrl,
  dueDate: tasks.dueDate,
  position: tasks.position,
  createdBy: tasks.createdBy,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
} as const;

/**
 * Даалгаврыг (төсөл, аймаг, гүйцэтгэгч) энэ хэрэглэгч ингэж тавьж болох
 * эсэх. Алдааны мессеж буцаана, болох бол `null`.
 *
 * • Аймгийн нэрийн өмнөөс зөвхөн тэр аймгийн гишүүн (эсвэл Харуул/админ).
 *   Ерөнхий ("") даалгаврыг зөвхөн Харуул/админ.
 * • Төсөл тэр аймагт харагддаг байх ёстой.
 * • Энгийн гишүүн зөвхөн өөрийн аймгийн идэвхтэй хүнд оноож чадна.
 */
export async function checkTaskTarget(
  user: UserRow | null,
  target: { projectId: string; aimag: string; assignedTo: string | null }
): Promise<string | null> {
  const myAimags = user?.aimags ?? [];
  const manager = canManageProjects(user?.role, myAimags);

  if (!canWorkInAimag(user?.role, myAimags, target.aimag)) {
    return target.aimag
      ? "Та энэ аймагт харьяалагдахгүй тул даалгавар үүсгэж чадахгүй."
      : "Ерөнхий даалгаврыг Харуулын аймаг үүсгэнэ — аймгаа сонгоно уу.";
  }

  const [project] = await db
    .select({ aimags: projects.aimags })
    .from(projects)
    .where(eq(projects.id, target.projectId))
    .limit(1);

  if (!project) return "Төсөл олдсонгүй.";
  if (target.aimag && !projectVisibleToAimag(project.aimags ?? [], target.aimag)) {
    return "Энэ төсөл сонгосон аймагт харагдахгүй байна.";
  }

  if (target.assignedTo && !manager) {
    const [assignee] = await db
      .select({ aimags: users.aimags, status: users.status })
      .from(users)
      .where(eq(users.uid, target.assignedTo))
      .limit(1);

    if (
      !assignee ||
      assignee.status !== "active" ||
      !(assignee.aimags ?? []).includes(target.aimag)
    ) {
      return "Гүйцэтгэгч нь тухайн аймгийн идэвхтэй гишүүн байх ёстой.";
    }
  }

  return null;
}
