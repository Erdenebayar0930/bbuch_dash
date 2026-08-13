import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { badRequest, requireActiveUser, serverError } from "@/lib/api/auth";
import { genders, isValidOption } from "@/data/profileOptions";
import { db } from "@/lib/db";
import { children } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Нэг хэрэглэгчид бүртгэх хүүхдийн дээд тоо — санамсаргүй их өгөгдлөөс хамгаална */
const MAX_CHILDREN = 20;

const isDate = (value: string) => {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
};

/** Өөрийн хүүхдүүдийн бүртгэл — маягт дээрх эрэмбээр. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await db
      .select()
      .from(children)
      .where(eq(children.uid, result.caller.uid))
      .orderBy(asc(children.position));

    return NextResponse.json({ children: rows });
  } catch (error) {
    return serverError(error, "Хүүхдийн бүртгэл уншихад алдаа гарлаа");
  }
}

/**
 * Бүртгэлийг бүхэлд нь солино (replace).
 *
 * Маягт дээр мөрүүдийг зэрэг засаж, нэг товчоор хадгалдаг тул мөр тус бүрийг
 * ялгаж update/delete хийхээс илүү энгийн бөгөөд эрэмбийг ч зөв хадгална.
 * Устгах, оруулах хоёрыг нэг гүйлгээнд хийнэ — дундуур тасарвал хуучин
 * бүртгэл алдагдахгүй.
 */
export async function PUT(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  const uid = result.caller.uid;

  try {
    const body = await request.json().catch(() => ({}));

    if (!Array.isArray(body.children)) {
      return badRequest("children нь жагсаалт байх ёстой.");
    }

    if (body.children.length > MAX_CHILDREN) {
      return badRequest(`Хүүхдийн тоо ${MAX_CHILDREN}-аас хэтрэхгүй байх ёстой.`);
    }

    const rows: {
      id: string;
      uid: string;
      name: string;
      birthDate: string;
      gender: string;
      position: number;
    }[] = [];

    for (const [index, item] of body.children.entries()) {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const birthDate = typeof item?.birthDate === "string" ? item.birthDate : "";
      const gender = typeof item?.gender === "string" ? item.gender : "";

      // Хоосон мөрийг чимээгүй алгасна — маягт дээр шинэ мөр нэмээд
      // бөглөөгүй орхиход алдаа заах нь илүүц
      if (!name && !birthDate && !gender) continue;

      if (!name) {
        return badRequest(`${index + 1}-р хүүхдийн нэрийг оруулна уу.`);
      }
      if (!isDate(birthDate)) {
        return badRequest(`${index + 1}-р хүүхдийн төрсөн огноо буруу байна.`);
      }
      if (!isValidOption(genders, gender)) {
        return badRequest(`${index + 1}-р хүүхдийн хүйс буруу байна.`);
      }

      rows.push({
        // MySQL нь INSERT ... RETURNING дэмждэггүй тул ID-г урьдчилж үүсгэнэ
        id: crypto.randomUUID(),
        uid,
        name,
        birthDate,
        gender,
        position: rows.length,
      });
    }

    const saved = await db.transaction(async (tx) => {
      await tx.delete(children).where(eq(children.uid, uid));

      if (rows.length === 0) return [];

      await tx.insert(children).values(rows);

      // Бүх мөр нэг хэрэглэгчийнх тул uid-аар нь эрэмбэтэй буцааж уншина
      return tx
        .select()
        .from(children)
        .where(eq(children.uid, uid))
        .orderBy(asc(children.position));
    });

    return NextResponse.json({ children: saved });
  } catch (error) {
    return serverError(error, "Хүүхдийн бүртгэл хадгалахад алдаа гарлаа");
  }
}
