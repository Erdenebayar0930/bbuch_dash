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

type TreeNode = { id: string; parentId: string | null; aimags: string[] };

/** Бүх төслийн мод — хүснэгт жижиг тул санах ойд ачаалж шалгана */
export async function loadProjectTree(): Promise<Map<string, TreeNode>> {
  const rows = await db
    .select({ id: projects.id, parentId: projects.parentId, aimags: projects.aimags })
    .from(projects);

  return new Map(
    rows.map((row) => [
      row.id,
      { id: row.id, parentId: row.parentId, aimags: row.aimags ?? [] },
    ])
  );
}

/** Төслийн гүн: үндсэн = 1. Эвдэрсэн (давталттай) мод бол Infinity. */
export function depthOf(id: string, tree: Map<string, TreeNode>): number {
  let depth = 0;
  let current: string | null = id;
  const seen = new Set<string>();

  while (current) {
    if (seen.has(current)) return Infinity;
    seen.add(current);
    depth += 1;
    current = tree.get(current)?.parentId ?? null;
  }
  return depth;
}

/**
 * Эх төслийн аймаг өөрчлөгдсөний дараа доорх бүх дэд төслийг шинэ хүрээнд
 * нь багтаана — эх харагдахгүй аймагт дэд нь үлдэхгүй.
 */
export async function cascadeChildAimags(
  rootId: string,
  rootAimags: string[],
  tree: Map<string, TreeNode>
): Promise<void> {
  const queue: { id: string; aimags: string[] }[] = [
    { id: rootId, aimags: rootAimags },
  ];

  while (queue.length > 0) {
    const parent = queue.shift()!;

    for (const child of tree.values()) {
      if (child.parentId !== parent.id) continue;

      const kept =
        parent.aimags.length === 0
          ? child.aimags
          : child.aimags.filter((aimag) => parent.aimags.includes(aimag));
      const next =
        parent.aimags.length > 0 && kept.length === 0 ? parent.aimags : kept;

      const changed =
        next.length !== child.aimags.length ||
        next.some((aimag) => !child.aimags.includes(aimag));

      if (changed) {
        await db
          .update(projects)
          .set({ aimags: next, updatedAt: new Date() })
          .where(eq(projects.id, child.id));
      }

      queue.push({ id: child.id, aimags: next });
    }
  }
}
