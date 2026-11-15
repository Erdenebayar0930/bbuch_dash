import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api/auth";
import { requireTahilt } from "@/lib/api/tahiltPlan";
import { readProject } from "@/lib/api/taskInput";
import { db } from "@/lib/db";
import { tahiltCommands } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Тушаалыг засна (нэр, тайлбар, архив) — Тахилтын гишүүн эсвэл админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const parsed = readProject(await request.json().catch(() => ({})), true);
    if (!parsed.ok) return badRequest(parsed.error);

    // Тахилтын тушаал аймаггүй — ирсэн `aimags`-ийг алгасна
    const { name, description, archived } = parsed.value;
    const patch = Object.fromEntries(
      Object.entries({ name, description, archived }).filter(
        ([, value]) => value !== undefined
      )
    );

    // Зөвхөн аймаг солих гэсэн хүсэлт энд утгагүй — амжилттай гэж үзнэ
    if (Object.keys(patch).length === 0) {
      return parsed.value.aimags !== undefined
        ? NextResponse.json({ ok: true })
        : badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const updated = await db
      .update(tahiltCommands)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(tahiltCommands.id, id))
      .returning({ id: tahiltCommands.id });

    if (updated.length === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тушаал засахад алдаа гарлаа");
  }
}

/**
 * Тушаалыг устгана — Тахилтын гишүүн эсвэл админ. Доторх дэд тушаал,
 * даалгавар хамт устна (FK cascade) — UI дээр анхааруулна.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireTahilt(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(tahiltCommands)
      .where(eq(tahiltCommands.id, id))
      .returning({ id: tahiltCommands.id });

    if (deleted.length === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Тушаал устгахад алдаа гарлаа");
  }
}
