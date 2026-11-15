import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { forbidden, isAdminRole, requireAimag } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { givingPeople, settings, users } from "@/lib/db/schema";

/** `settings` дахь түлхүүр — сар бүрийн сахилгажуулалтын дүн (төгрөг) */
const AMOUNT_KEY = "discipline_monthly_amount";

/** `settings` дахь түлхүүр — төлсөн/төлөөгүйг чагтлах ганц хүний uid */
const CHECKER_KEY = "discipline_checker_uid";

/** Анхны дүн — админ солих хүртэл */
export const DEFAULT_DISCIPLINE_AMOUNT = 450000;

/** Сахилгажуулалтын жагсаалт `giving_people` дотор энэ board-оор хадгалагдана */
export const DISCIPLINE_BOARD = "discipline";

/** Жагсаалтад автоматаар орох аймаг */
export const DISCIPLINE_AIMAG = "supply";

export async function readDisciplineAmount(): Promise<number> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, AMOUNT_KEY))
    .limit(1);

  const value = Number(row?.value);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DISCIPLINE_AMOUNT;
}

export async function writeDisciplineAmount(amount: number): Promise<void> {
  const value = String(amount);
  await db
    .insert(settings)
    .values({ key: AMOUNT_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/**
 * Хангамжийн аймгийн идэвхтэй гишүүдээс жагсаалтад байхгүйг нь нэмнэ.
 * `(board, uid)` unique индекс давхардлаас хамгаална.
 */
export async function syncDisciplineMembers(createdBy: string): Promise<void> {
  const members = await db
    .select({ uid: users.uid, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(
      and(
        eq(users.status, "active"),
        sql`${users.aimags} @> ${JSON.stringify([DISCIPLINE_AIMAG])}::jsonb`
      )
    );
  if (members.length === 0) return;

  const listed = await db
    .select({ uid: givingPeople.uid })
    .from(givingPeople)
    .where(eq(givingPeople.board, DISCIPLINE_BOARD));
  const listedUids = new Set(listed.map((row) => row.uid));

  const missing = members
    .filter((member) => !listedUids.has(member.uid))
    .sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "mn")
    );
  if (missing.length === 0) return;

  const [{ next }] = await db
    .select({ next: sql<number>`(coalesce(max(${givingPeople.position}), -1) + 1)::int` })
    .from(givingPeople)
    .where(eq(givingPeople.board, DISCIPLINE_BOARD));

  await db
    .insert(givingPeople)
    .values(
      missing.map((member, index) => ({
        board: DISCIPLINE_BOARD,
        uid: member.uid,
        name: [member.lastName, member.firstName].filter(Boolean).join(" ") || "Нэргүй",
        position: next + index,
        createdBy,
      }))
    )
    .onConflictDoNothing({ target: [givingPeople.board, givingPeople.uid] });
}

async function readSetting(key: string): Promise<string> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row?.value ?? "";
}

/** Чагтлагчийн uid — сонгоогүй бол хоосон */
export const readDisciplineChecker = () => readSetting(CHECKER_KEY);

export async function writeDisciplineChecker(uid: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: CHECKER_KEY, value: uid })
    .onConflictDoUpdate({ target: settings.key, set: { value: uid, updatedAt: new Date() } });
}

/**
 * Сахилгажуулалтын хандалт — Хангамжийн аймгийн гишүүн эсвэл админ.
 *
 * `canCheck`: чагтлагч сонгосон бол ЗӨВХӨН тэр хүн (админ ч биш), сонгоогүй
 * бол админ. `canView`: төлөлтийн хүснэгтийг харах — админ эсвэл чагтлагч.
 */
export async function requireDisciplineAccess(request: Parameters<typeof requireAimag>[0]) {
  const result = await requireAimag(request, DISCIPLINE_AIMAG);
  if ("error" in result && result.error) return { error: result.error } as const;
  const { caller } = result;

  const isAdmin = isAdminRole(caller.user?.role);
  const checkerUid = await readDisciplineChecker();
  const canCheck = checkerUid ? checkerUid === caller.uid : isAdmin;

  return {
    caller,
    isAdmin,
    checkerUid,
    canCheck,
    canView: isAdmin || canCheck,
  } as const;
}

/** Төлөлтийн хүснэгтийг харах эрх (админ эсвэл чагтлагч) */
export async function requireDisciplineViewer(request: Parameters<typeof requireAimag>[0]) {
  const result = await requireDisciplineAccess(request);
  if ("error" in result) return result;
  if (!result.canView) return { error: forbidden("Төлөлтийн бүртгэлийг үзэх эрхгүй.") } as const;
  return result;
}

/** Чагтлах эрх — сонгогдсон чагтлагч (эсвэл сонгоогүй үед админ) */
export async function requireDisciplineChecker(request: Parameters<typeof requireAimag>[0]) {
  const result = await requireDisciplineAccess(request);
  if ("error" in result) return result;
  if (!result.canCheck) {
    return {
      error: forbidden("Зөвхөн сонгогдсон чагтлагч төлөлтийг тэмдэглэнэ."),
    } as const;
  }
  return result;
}
