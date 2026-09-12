import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Төхөөрөмжийг идэвхтэй/идэвхгүй болгоно (зөвхөн өөрийнх).
 * Идэвхгүй болгомогц тэр төхөөрөмж дараагийн API хүсэлт дээрээ шууд гарна
 * — шалгалт нь `requireActiveUser`-д, зочилсон хугацаанд биш.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const body = await request.json();
    if (typeof body.active !== "boolean") {
      return badRequest("active нь true/false байна.");
    }

    const [existing] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.uid, result.caller.uid)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Төхөөрөмж олдсонгүй." }, { status: 404 });
    }

    await db
      .update(devices)
      .set({ active: body.active })
      .where(eq(devices.id, id));

    const [updated] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);

    return NextResponse.json({ device: updated });
  } catch (error) {
    return serverError(error, "Төхөөрөмжийн төлөв өөрчлөхөд алдаа гарлаа.");
  }
}

/** Төхөөрөмжийн бүртгэлийг устгана (зөвхөн өөрийнх). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.uid, result.caller.uid)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Төхөөрөмж олдсонгүй." }, { status: 404 });
    }

    await db.delete(devices).where(eq(devices.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Төхөөрөмж устгахад алдаа гарлаа.");
  }
}
