import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { cascadeChildAimags, loadProjectTree } from "@/lib/api/planAccess";
import { readProject } from "@/lib/api/taskInput";
import { fitChildAimags } from "@/data/taskOptions";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { canManageProjects } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Харуулын аймаг эсвэл админ эсэхийг шалгана. */
async function requireProjectManager(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result;

  const user = result.caller.user;
  if (!canManageProjects(user?.role, user?.aimags)) {
    return {
      error: forbidden("Тушаалыг зөвхөн Харуулын аймаг удирдана."),
    } as const;
  }
  return result;
}

/** Тушаалыг засна (нэр, харагдах аймгууд) — Харуулын аймаг эсвэл админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireProjectManager(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readProject(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const tree = await loadProjectTree();
    const current = tree.get(id);

    if (!current) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    const patch = { ...parsed.value };

    // Дэд тушаалын аймгууд эхийнхээ хүрээнд байх ёстой
    if (patch.aimags !== undefined && current.parentId) {
      const parent = tree.get(current.parentId);
      const fitted = fitChildAimags(parent?.aimags ?? [], patch.aimags);
      if (!fitted) {
        return badRequest("Дэд тушаал зөвхөн эх тушаалын аймгуудад харагдана.");
      }
      patch.aimags = fitted;
    }

    await db
      .update(projects)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(projects.id, id));

    // Аймаг өөрчлөгдвөл доорх дэд тушаалуудыг шинэ хүрээнд нь багтаана
    if (patch.aimags !== undefined) {
      await cascadeChildAimags(id, patch.aimags, tree);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тушаал засахад алдаа гарлаа");
  }
}

/**
 * Тушаалыг устгана — ЗӨВХӨН Харуулын аймаг (ба админ).
 * Доторх бүх дэд тушаал, даалгавар хамт устана (FK cascade) — UI дээр
 * анхааруулна.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireProjectManager(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.delete(projects).where(eq(projects.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тушаал устгахад алдаа гарлаа");
  }
}
