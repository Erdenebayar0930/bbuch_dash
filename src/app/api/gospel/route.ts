import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { gospelAimags } from "@/data/gospelOptions";
import { badRequest, forbidden, requireAimag, serverError } from "@/lib/api/auth";
import {
  checkContactArea,
  gospelSelection,
  readGospelContact,
  todayInUlaanbaatar,
} from "@/lib/api/gospelInput";
import { db } from "@/lib/db";
import { gospelContacts, users } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Бүх бүртгэл — гурван аймгийн аль нэгний гишүүн эсвэл админ үзнэ. */
export async function GET(request: NextRequest) {
  const result = await requireAimag(request, gospelAimags);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select(gospelSelection)
      .from(gospelContacts)
      .leftJoin(users, eq(users.uid, gospelContacts.sharedBy))
      .orderBy(desc(gospelContacts.sharedOn), desc(gospelContacts.createdAt));

    return NextResponse.json({ contacts: rows });
  } catch (error) {
    return serverError(error, "Сайн мэдээний бүртгэл уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ бүртгэл нэмнэ. Хүргэсэн хүн нь бүртгэж буй гишүүн өөрөө.
 *
 * Энгийн гишүүн зөвхөн өөрийн харьяалагдах аймгийн нэрээр бүртгэнэ —
 * админ аль ч аймгийг сонгож болно.
 */
export async function POST(request: NextRequest) {
  const result = await requireAimag(request, gospelAimags);
  if ("error" in result) return result.error;

  const { caller } = result;

  try {
    const parsed = readGospelContact(await request.json().catch(() => ({})), false, {
      uid: caller.uid,
    });
    if (!parsed.ok) return badRequest(parsed.error);

    const input = parsed.value;

    const areaError = await checkContactArea(input.areaId as string);
    if (areaError) return badRequest(areaError);

    const aimag = input.aimag as string;

    if (
      !isAdminRole(caller.user?.role) &&
      !(caller.user?.aimags ?? []).includes(aimag)
    ) {
      return forbidden("Зөвхөн өөрийн аймгийн нэрээр бүртгэнэ.");
    }

    const [created] = await db
      .insert(gospelContacts)
      .values({
        ...input,
        name: input.name as string,
        // Бүртгэсэн өдөр — клиентээс авахгүй, сервер өөрөө оноодог
        sharedOn: todayInUlaanbaatar(),
        areaId: input.areaId as string,
        aimag,
        sharedBy: caller.uid,
      })
      .returning({ id: gospelContacts.id });

    const [row] = await db
      .select(gospelSelection)
      .from(gospelContacts)
      .leftJoin(users, eq(users.uid, gospelContacts.sharedBy))
      .where(eq(gospelContacts.id, created.id))
      .limit(1);

    return NextResponse.json({ contact: row });
  } catch (error) {
    return serverError(error, "Бүртгэл нэмэхэд алдаа гарлаа");
  }
}
