import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import {
  DISCIPLINE_AIMAG,
  DISCIPLINE_BOARD,
  requireDisciplineViewer,
  syncDisciplineMembers,
} from "@/lib/api/discipline";
import { db } from "@/lib/db";
import { givingMarks, givingPeople, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** tithe — 1/10 ба өргөл, land — Газрын 1/10, discipline — Сахилгажуулалт */
const BOARDS = new Set(["tithe", "land", DISCIPLINE_BOARD]);

const readBoard = (value: unknown) =>
  typeof value === "string" && BOARDS.has(value) ? value : null;

/**
 * «Өргөж буй байдал» — тухайн жагсаалтын хүмүүс ба `?year=`-ийн өргөсөн
 * сарууд. Зөвхөн админ (хэн хэдэн сард өргөсөн нь хувийн мэдээлэл).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const board = readBoard(params.get("board"));
  const year = Number(params.get("year"));

  if (!board) return badRequest("board буруу байна.");

  // Сахилгажуулалтыг админаас гадна сонгогдсон чагтлагч ч харна
  const result =
    board === DISCIPLINE_BOARD
      ? await requireDisciplineViewer(request)
      : await requireAdmin(request);
  if ("error" in result) return result.error;

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return badRequest("year буруу байна.");
  }

  try {
    // Сахилгажуулалт: Хангамжийн аймгийн гишүүд жагсаалтад өөрөө орно
    if (board === DISCIPLINE_BOARD) await syncDisciplineMembers(result.caller.uid);

    const rows = await db
      .select({
        id: givingPeople.id,
        uid: givingPeople.uid,
        name: givingPeople.name,
        firstName: users.firstName,
        lastName: users.lastName,
        position: givingPeople.position,
        aimags: users.aimags,
      })
      .from(givingPeople)
      .leftJoin(users, eq(givingPeople.uid, users.uid))
      .where(eq(givingPeople.board, board))
      .orderBy(asc(givingPeople.position), asc(givingPeople.createdAt));

    // `inAimag` — аймгаас автоматаар орсон тул хасах боломжгүй (дахин орно)
    const people = rows.map(({ aimags, ...row }) => ({
      ...row,
      inAimag:
        board === DISCIPLINE_BOARD && Array.isArray(aimags) && aimags.includes(DISCIPLINE_AIMAG),
    }));

    const marks =
      people.length > 0
        ? await db
            .select({ personId: givingMarks.personId, month: givingMarks.month })
            .from(givingMarks)
            .where(
              and(
                inArray(
                  givingMarks.personId,
                  people.map((person) => person.id)
                ),
                gte(givingMarks.month, `${year}-01`),
                lte(givingMarks.month, `${year}-12`)
              )
            )
        : [];

    return NextResponse.json({ people, marks });
  } catch (error) {
    return serverError(error, "Өргөлийн бүртгэл уншихад алдаа гарлаа");
  }
}

/**
 * Жагсаалтад хүн нэмнэ — системийн хэрэглэгч (`uid`) эсвэл чөлөөт нэр (`name`).
 * Зөвхөн админ.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const body = await request.json().catch(() => ({}));
    const board = readBoard(body.board);
    if (!board) return badRequest("board буруу байна.");

    const uid = typeof body.uid === "string" && body.uid ? body.uid : null;
    let name = typeof body.name === "string" ? body.name.trim() : "";

    if (uid) {
      const [user] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1);
      if (!user) return badRequest("Хэрэглэгч олдсонгүй.");

      const [existing] = await db
        .select({ id: givingPeople.id })
        .from(givingPeople)
        .where(and(eq(givingPeople.board, board), eq(givingPeople.uid, uid)))
        .limit(1);
      if (existing) return badRequest("Энэ хүн жагсаалтад аль хэдийн байна.");

      // Хэрэглэгч устсан ч жагсаалтад нэр нь үлдэхийн тулд хадгална
      name = [user.lastName, user.firstName].filter(Boolean).join(" ") || "Нэргүй";
    } else if (!name) {
      return badRequest("Нэрээ оруулна уу.");
    }

    if (name.length > 255) return badRequest("Нэр хэт урт байна.");

    const [{ next }] = await db
      .select({ next: sql<number>`(coalesce(max(${givingPeople.position}), -1) + 1)::int` })
      .from(givingPeople)
      .where(eq(givingPeople.board, board));

    const [created] = await db
      .insert(givingPeople)
      .values({ board, uid, name, position: next, createdBy: result.caller.uid })
      .returning({ id: givingPeople.id });

    return NextResponse.json({ id: created.id });
  } catch (error) {
    return serverError(error, "Хүн нэмэхэд алдаа гарлаа");
  }
}
