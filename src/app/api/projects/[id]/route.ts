import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  requireActiveUser,
  serverError,
} from "@/lib/api/auth";
import { readProject } from "@/lib/api/taskInput";
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
      error: forbidden("Төслийг зөвхөн Харуулын аймаг удирдана."),
    } as const;
  }
  return result;
}

/** Төслийг засна (нэр, харагдах аймгууд) — Харуулын аймаг эсвэл админ. */
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

    await db
      .update(projects)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(projects.id, id));

    const [updated] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Төсөл засахад алдаа гарлаа");
  }
}

/**
 * Төслийг устгана — ЗӨВХӨН Харуулын аймаг (ба админ).
 * Доторх бүх даалгавар хамт устана (FK cascade) — UI дээр анхааруулна.
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
    return serverError(error, "Төсөл устгахад алдаа гарлаа");
  }
}
