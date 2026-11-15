import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { gospelAimags } from "@/data/gospelOptions";
import {
  badRequest,
  forbidden,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import {
  checkContactArea,
  gospelSelection,
  readGospelContact,
} from "@/lib/api/gospelInput";
import { db } from "@/lib/db";
import { gospelContacts, users } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });

/** Бүртгэлийг засна — бүртгэсэн гишүүн өөрөө эсвэл админ. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAimag(request, gospelAimags);
  if ("error" in result) return result.error;

  const { caller } = result;
  const { id } = await context.params;
  const isAdmin = isAdminRole(caller.user?.role);

  try {
    const [existing] = await db
      .select({ sharedBy: gospelContacts.sharedBy, photoPath: gospelContacts.photoPath })
      .from(gospelContacts)
      .where(eq(gospelContacts.id, id))
      .limit(1);

    if (!existing) return notFound();
    if (!isAdmin && existing.sharedBy !== caller.uid) {
      return forbidden("Зөвхөн өөрийн бүртгэлээ засна.");
    }

    const parsed = readGospelContact(await request.json().catch(() => ({})), true, {
      uid: caller.uid,
      currentPath: existing.photoPath || undefined,
    });
    if (!parsed.ok) return badRequest(parsed.error);
    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    const { aimag } = parsed.value;

    if (parsed.value.areaId) {
      const areaError = await checkContactArea(parsed.value.areaId);
      if (areaError) return badRequest(areaError);
    }
    if (aimag && !isAdmin && !(caller.user?.aimags ?? []).includes(aimag)) {
      return forbidden("Зөвхөн өөрийн аймгийн нэрээр бүртгэнэ.");
    }

    await db
      .update(gospelContacts)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(gospelContacts.id, id));

    const [row] = await db
      .select(gospelSelection)
      .from(gospelContacts)
      .leftJoin(users, eq(users.uid, gospelContacts.sharedBy))
      .where(eq(gospelContacts.id, id))
      .limit(1);

    return NextResponse.json({ contact: row });
  } catch (error) {
    return serverError(error, "Бүртгэл засахад алдаа гарлаа");
  }
}

/** Бүртгэлийг устгана — өгөгдөл устгах нь зөвхөн админд. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const deleted = await db
      .delete(gospelContacts)
      .where(eq(gospelContacts.id, id))
      .returning({ id: gospelContacts.id });

    if (deleted.length === 0) return notFound();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Бүртгэл устгахад алдаа гарлаа");
  }
}
