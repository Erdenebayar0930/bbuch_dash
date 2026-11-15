import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { MAX_PROJECT_DEPTH } from "@/data/taskOptions";
import { badRequest, serverError } from "@/lib/api/auth";
import {
  asProject,
  commandColumns,
  commandDepth,
  loadCommandTree,
  requireTahilt,
} from "@/lib/api/tahiltPlan";
import { readProject } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { tahiltCommands, tahiltTasks } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Тахилтын бүх тушаал — даалгаврын тоотой. Тахилтын гишүүн эсвэл админ. */
export async function GET(request: NextRequest) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select(commandColumns)
      .from(tahiltCommands)
      .orderBy(asc(tahiltCommands.position), asc(tahiltCommands.createdAt));

    const counts = await db
      .select({
        commandId: tahiltTasks.commandId,
        total: count(),
        open: sql<number>`sum(case when ${tahiltTasks.status} <> 'done' then 1 else 0 end)::int`,
      })
      .from(tahiltTasks)
      .groupBy(tahiltTasks.commandId);

    const byCommand = new Map(counts.map((row) => [row.commandId, row]));

    return NextResponse.json({
      projects: rows.map((row) => ({
        ...asProject(row),
        taskCount: Number(byCommand.get(row.id)?.total ?? 0),
        openCount: Number(byCommand.get(row.id)?.open ?? 0),
      })),
    });
  } catch (error) {
    return serverError(error, "Тушаалуудыг уншихад алдаа гарлаа");
  }
}

/** Шинэ тушаал эсвэл дэд тушаал — Тахилтын гишүүн эсвэл админ. */
export async function POST(request: NextRequest) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  try {
    // `aimags` ирсэн ч үл тооно — Тахилтын тушаал аймаггүй
    const parsed = readProject(await request.json().catch(() => ({})), false);
    if (!parsed.ok) return badRequest(parsed.error);

    const name = parsed.value.name as string;
    const parentId = parsed.value.parentId ?? null;

    if (parentId) {
      const tree = await loadCommandTree();
      if (!tree.has(parentId)) return badRequest("Эх тушаал олдсонгүй.");

      if (commandDepth(parentId, tree) >= MAX_PROJECT_DEPTH) {
        return badRequest(`Дэд тушаал ${MAX_PROJECT_DEPTH} түвшнээс гүн байж болохгүй.`);
      }
    }

    const [duplicate] = await db
      .select({ id: tahiltCommands.id })
      .from(tahiltCommands)
      .where(
        and(
          eq(tahiltCommands.name, name),
          parentId ? eq(tahiltCommands.parentId, parentId) : isNull(tahiltCommands.parentId)
        )
      )
      .limit(1);

    if (duplicate) return badRequest(`"${name}" нэртэй тушаал энд аль хэдийн байна.`);

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${tahiltCommands.position}), -1) + 1` })
      .from(tahiltCommands);

    const [created] = await db
      .insert(tahiltCommands)
      .values({
        name,
        parentId,
        description: parsed.value.description ?? "",
        position: next,
        createdBy: result.caller.uid,
      })
      .returning(commandColumns);

    return NextResponse.json({
      project: { ...asProject(created), taskCount: 0, openCount: 0 },
    });
  } catch (error) {
    return serverError(error, "Тушаал үүсгэхэд алдаа гарлаа");
  }
}
