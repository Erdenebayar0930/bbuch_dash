import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, tasks, users } from "@/lib/db/schema";
import {
  canManageProjects,
  canSeeAllPlans,
  canWorkInAnyAimag,
  projectVisibleToAimag,
} from "@/lib/permissions";

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UserRow } from "@/lib/db/schema";

/**
 * Төлөвлөгөөний (төсөл, даалгавар) харагдах дүрэм — нэг л газар.
 *
 * • Харуулын аймаг ба админ: бүгдийг.
 * • Бусад: өөрийн аймагт харагдах төсөл (`aimags` хоосон = бүх аймагт), тэр
 *   дотроос өөрийн аймаг оролцсон болон ерөнхий (аймаггүй) даалгавар.
 */

/** jsonb массив хоосон эсвэл өгөгдсөн аймгуудын аль нэгийг агуулах эсэх */
function emptyOrContainsAny(column: AnyPgColumn, list: string[]) {
  return or(
    sql`jsonb_array_length(${column}) = 0`,
    ...list.map((aimag) => sql`${column} @> ${JSON.stringify([aimag])}::jsonb`)
  );
}

/** Төслийн шүүлт. `undefined` = хязгааргүй. */
export function projectVisibility(user: UserRow | null) {
  const myAimags = user?.aimags ?? [];
  if (canSeeAllPlans(user?.role, myAimags)) return undefined;

  return emptyOrContainsAny(projects.aimags, myAimags);
}

/** Даалгаврын шүүлт (projects-тэй join хийсэн query-д). */
export function taskVisibility(user: UserRow | null) {
  const myAimags = user?.aimags ?? [];
  if (canSeeAllPlans(user?.role, myAimags)) return undefined;

  return and(
    projectVisibility(user),
    emptyOrContainsAny(tasks.aimags, myAimags)
  );
}

/** "Надад хамаатай" — ерөнхий хариуцагч эсвэл хамтрагч */
export const involvesUser = (uid: string) =>
  or(
    eq(tasks.assignedTo, uid),
    sql`${tasks.collaborators} @> ${JSON.stringify([uid])}::jsonb`
  );

/** Даалгаврын жагсаалтын багана — tasks GET/POST/PATCH бүгд ашиглана */
export const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  projectName: projects.name,
  projectAimags: projects.aimags,
  aimags: tasks.aimags,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  assignedTo: tasks.assignedTo,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneePhotoUrl: users.photoUrl,
  collaborators: tasks.collaborators,
  dueDate: tasks.dueDate,
  position: tasks.position,
  createdBy: tasks.createdBy,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
} as const;

/** Хамтрагчдын нэрийг мөр бүрд хавсаргана — нэг нэмэлт query-гээр. */
export async function attachCollaborators<
  T extends { collaborators: string[] | null },
>(rows: T[]): Promise<(T & { collaboratorNames: string[] })[]> {
  const uids = [...new Set(rows.flatMap((row) => row.collaborators ?? []))];

  const people =
    uids.length > 0
      ? await db
          .select({
            uid: users.uid,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.uid, uids))
      : [];

  const names = new Map(
    people.map((person) => [
      person.uid,
      [person.firstName, person.lastName].filter(Boolean).join(" ") || "Нэргүй",
    ])
  );

  return rows.map((row) => ({
    ...row,
    collaboratorNames: (row.collaborators ?? []).map(
      (uid) => names.get(uid) ?? "Нэргүй"
    ),
  }));
}

/** Нэг даалгаврыг жагсаалтын хэлбэрээр (хамтрагчдын нэртэй) уншина. */
export async function readTaskRow(id: string) {
  const rows = await db
    .select(taskColumns)
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(users, eq(tasks.assignedTo, users.uid))
    .where(eq(tasks.id, id))
    .limit(1);

  const [row] = await attachCollaborators(rows);
  return row ?? null;
}

/** Мэдэгдлээс очих хуудас — нэг аймгийнх бол тэр аймгийн, үгүй бол Харуулын */
export const planUrl = (aimags: string[] | null) =>
  aimags && aimags.length === 1
    ? `/aimag/${aimags[0]}/plan`
    : "/aimag/guard/plan";

/**
 * Даалгаврыг (төсөл, аймгууд, хариуцагч, хамтрагчид) энэ хэрэглэгч ингэж
 * тавьж болох эсэх. Алдааны мессеж буцаана, болох бол `null`.
 *
 * • Энгийн гишүүн өөрийн аймгийн аль нэгийг заавал оруулна; ерөнхий
 *   (аймаггүй) даалгаврыг зөвхөн Харуул/админ.
 * • Сонгосон аймаг бүрт төсөл харагддаг байх ёстой.
 * • Энгийн гишүүн зөвхөн сонгосон аймгуудын идэвхтэй хүмүүсийг хариуцагч,
 *   хамтрагч болгоно.
 */
export async function checkTaskTarget(
  user: UserRow | null,
  target: {
    projectId: string;
    aimags: string[];
    assignedTo: string | null;
    collaborators: string[];
  }
): Promise<string | null> {
  const myAimags = user?.aimags ?? [];
  const manager = canManageProjects(user?.role, myAimags);

  if (!canWorkInAnyAimag(user?.role, myAimags, target.aimags)) {
    return target.aimags.length > 0
      ? "Сонгосон аймгуудын дунд таны аймаг байх ёстой."
      : "Ерөнхий даалгаврыг Харуулын аймаг үүсгэнэ — аймгаа сонгоно уу.";
  }

  const [project] = await db
    .select({ aimags: projects.aimags })
    .from(projects)
    .where(eq(projects.id, target.projectId))
    .limit(1);

  if (!project) return "Төсөл олдсонгүй.";
  const hidden = target.aimags.find(
    (aimag) => !projectVisibleToAimag(project.aimags ?? [], aimag)
  );
  if (hidden) return "Төсөл сонгосон аймгуудын заримд харагдахгүй байна.";

  const people = [
    ...new Set([
      ...(target.assignedTo ? [target.assignedTo] : []),
      ...target.collaborators,
    ]),
  ];
  if (people.length === 0) return null;

  const rows = await db
    .select({ uid: users.uid, aimags: users.aimags, status: users.status })
    .from(users)
    .where(inArray(users.uid, people));

  if (rows.length !== people.length) return "Сонгосон хүн олдсонгүй.";
  if (manager) return null;

  const outsider = rows.find(
    (row) =>
      row.status !== "active" ||
      !(row.aimags ?? []).some((aimag) => target.aimags.includes(aimag))
  );
  if (outsider) {
    return "Хариуцагч, хамтрагчид нь сонгосон аймгуудын идэвхтэй гишүүд байх ёстой.";
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
