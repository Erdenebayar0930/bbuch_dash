import "server-only";

import { eq, inArray } from "drizzle-orm";

import { requireAimag } from "@/lib/api/auth";
import { attachCollaborators } from "@/lib/api/planAccess";
import { db } from "@/lib/db";
import { tahiltCommands, tahiltTasks, users } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

/**
 * Тахилтын «Тушаал» самбар — бусад аймгийн Төлөвлөгөөнөөс тусдаа хүснэгттэй
 * (`tahilt_commands`, `tahilt_tasks`).
 *
 * Эрх нь энгийн: Тахилтын гишүүд ба админ бүгдийг харж, тушаал удирдаж,
 * даалгавар үүсгэнэ (Төлөвлөгөөн дэх Харуулын аймгийн эрхтэй адил).
 *
 * Хариу нь `/api/projects`, `/api/tasks`-ийн хэлбэртэй ижил — нэг самбарын UI
 * хоёуланд ажиллана. Аймгийн багана байхгүй тул `aimags` нь үргэлж
 * `["tahilt"]` гэж буцна.
 */

export const TAHILT = "tahilt";
const TAHILT_AIMAGS = [TAHILT];

/** Тушаалаас мэдэгдэл очих хуудас */
export const TAHILT_COMMANDS_URL = "/tahilt/commands";

/** Тахилтын гишүүн эсвэл админ — бусад нь 403. */
export const requireTahilt = (request: NextRequest) => requireAimag(request, TAHILT);

/** Тушаалын хариуны багана */
export const commandColumns = {
  id: tahiltCommands.id,
  name: tahiltCommands.name,
  parentId: tahiltCommands.parentId,
  description: tahiltCommands.description,
  position: tahiltCommands.position,
  archived: tahiltCommands.archived,
  createdAt: tahiltCommands.createdAt,
} as const;

/** Тушаалын мөрийг `/api/projects`-ийн хэлбэрт оруулна */
export const asProject = <T extends object>(row: T) => ({ ...row, aimags: TAHILT_AIMAGS });

/** Даалгаврын хариуны багана — `taskColumns`-тай ижил нэртэй */
export const tahiltTaskColumns = {
  id: tahiltTasks.id,
  projectId: tahiltTasks.commandId,
  projectName: tahiltCommands.name,
  title: tahiltTasks.title,
  description: tahiltTasks.description,
  status: tahiltTasks.status,
  priority: tahiltTasks.priority,
  assignedTo: tahiltTasks.assignedTo,
  assigneeFirstName: users.firstName,
  assigneeLastName: users.lastName,
  assigneePhotoUrl: users.photoUrl,
  collaborators: tahiltTasks.collaborators,
  dueDate: tahiltTasks.dueDate,
  position: tahiltTasks.position,
  createdBy: tahiltTasks.createdBy,
  completedAt: tahiltTasks.completedAt,
  createdAt: tahiltTasks.createdAt,
} as const;

/** Даалгаврын мөрүүдийг хамтрагчдын нэр, аймагтай болгоно */
export async function asTaskRows<T extends { collaborators: string[] | null }>(rows: T[]) {
  const withNames = await attachCollaborators(rows);
  return withNames.map((row) => ({
    ...row,
    projectAimags: TAHILT_AIMAGS,
    aimags: TAHILT_AIMAGS,
  }));
}

/** Нэг даалгаврыг жагсаалтын хэлбэрээр уншина. */
export async function readTahiltTaskRow(id: string) {
  const rows = await db
    .select(tahiltTaskColumns)
    .from(tahiltTasks)
    .innerJoin(tahiltCommands, eq(tahiltTasks.commandId, tahiltCommands.id))
    .leftJoin(users, eq(tahiltTasks.assignedTo, users.uid))
    .where(eq(tahiltTasks.id, id))
    .limit(1);

  const [row] = await asTaskRows(rows);
  return row ?? null;
}

/** Тушаал байгаа эсэх — `readTask`-д дамжуулна */
export async function commandExists(id: string): Promise<boolean> {
  const [found] = await db
    .select({ id: tahiltCommands.id })
    .from(tahiltCommands)
    .where(eq(tahiltCommands.id, id))
    .limit(1);
  return !!found;
}

type TreeNode = { id: string; parentId: string | null };

/** Бүх тушаалын мод — хүснэгт жижиг тул санах ойд ачаална */
export async function loadCommandTree(): Promise<Map<string, TreeNode>> {
  const rows = await db
    .select({ id: tahiltCommands.id, parentId: tahiltCommands.parentId })
    .from(tahiltCommands);
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Хариуцагч ба хамтрагчид — байх ёстой бөгөөд админ биш хэрэглэгч зөвхөн
 * Тахилтын идэвхтэй гишүүдийг сонгоно.
 */
export async function checkTahiltPeople(
  callerRole: string | null | undefined,
  people: string[]
): Promise<string | null> {
  const unique = [...new Set(people.filter(Boolean))];
  if (unique.length === 0) return null;

  const rows = await db
    .select({ uid: users.uid, aimags: users.aimags, status: users.status })
    .from(users)
    .where(inArray(users.uid, unique));

  if (rows.length !== unique.length) return "Сонгосон хүн олдсонгүй.";
  if (isAdminRole(callerRole)) return null;

  const outsider = rows.find(
    (row) => row.status !== "active" || !(row.aimags ?? []).includes(TAHILT)
  );
  return outsider
    ? "Хариуцагч, хамтрагчид нь Тахилтын идэвхтэй гишүүд байх ёстой."
    : null;
}

/** Тушаалын гүн: үндсэн = 1. Эвдэрсэн (давталттай) мод бол Infinity. */
export function commandDepth(id: string, tree: Map<string, TreeNode>): number {
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
