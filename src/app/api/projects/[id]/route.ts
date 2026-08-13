import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireAdmin, serverError } from "@/lib/api/auth";
import { readProject } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Төслийг засна (зөвхөн админ). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readProject(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина
    await db
      .update(projects)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(projects.id, id));

    const [updated] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    return NextResponse.json({ project: updated });
  } catch (error) {
    return serverError(error, "Төсөл засахад алдаа гарлаа");
  }
}

/**
 * Төслийг устгана (зөвхөн админ).
 * Доторх бүх даалгавар хамт устана (FK cascade) — UI дээр анхааруулна.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    // MySQL нь DELETE ... RETURNING дэмждэггүй — эхлээд байгаа эсэхийг шалгана
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
