import { asc, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { children, users } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Хэрэглэгчдийн дэлгэрэнгүй жагсаалт — профайлын бүх талбар ба хүүхдүүд
 * (зөвхөн админ). Хүүхдийг нэг удаагийн уншилтаар авч хэрэглэгч бүрт
 * хуваарилна — хүн бүрээр тусад нь асуухгүй.
 */
export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const [userRows, childRows] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db
        .select({
          uid: children.uid,
          name: children.name,
          birthDate: children.birthDate,
          gender: children.gender,
        })
        .from(children)
        .orderBy(asc(children.uid), asc(children.position)),
    ]);

    const byUser = new Map<string, Omit<(typeof childRows)[number], "uid">[]>();
    for (const { uid, ...child } of childRows) {
      const list = byUser.get(uid);
      if (list) list.push(child);
      else byUser.set(uid, [child]);
    }

    return NextResponse.json({
      users: userRows.map((user) => ({
        ...user,
        children: byUser.get(user.uid) ?? [],
      })),
    });
  } catch (error) {
    return serverError(error, "Хэрэглэгчдийн мэдээллийг уншихад алдаа гарлаа");
  }
}
