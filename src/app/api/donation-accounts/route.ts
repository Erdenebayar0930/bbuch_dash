import { eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isBank } from "@/data/donationAccounts";
import { aimags, isValidOption } from "@/data/profileOptions";
import {
  badRequest,
  isAdminRole,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import {
  canViewAccount,
  readDonationAccounts,
} from "@/lib/api/donationAccounts";
import { db } from "@/lib/db";
import { donationAccounts } from "@/lib/db/schema";

import type { DonationAccountRow } from "@/lib/db/schema";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 200;
const MAX_NUMBER = 40;

/**
 * Дуудагчид харуулах хэлбэрт буулгана.
 *
 * Эрхийн жагсаалт нь ХЭН ХАРЖ БАЙГААГ илчилдэг тул зөвхөн админд явна —
 * энгийн хэрэглэгчид өөрт нь эрх байгаа эсэх (`canView`) л хангалттай.
 */
function toView(row: DonationAccountRow, isAdmin: boolean, canView: boolean) {
  return {
    id: row.id,
    title: row.title,
    number: row.number,
    bank: row.bank,
    holder: row.holder,
    position: row.position,
    isTithe: row.isTithe,
    canView,
    ...(isAdmin
      ? { allowedUids: row.allowedUids, allowedAimags: row.allowedAimags }
      : {}),
  };
}

/**
 * Дансны жагсаалт — БҮХ идэвхтэй хэрэглэгчид.
 *
 * Хандив өгөхийн тулд дугаар нь хэрэгтэй тул картыг нуухгүй. Доторх гүйлгээ
 * харагдах эсэхийг `canView` хэлнэ.
 */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const rows = await readDonationAccounts();
    const user = result.caller.user;
    const isAdmin = isAdminRole(user?.role);

    return NextResponse.json({
      accounts: rows.map((row) =>
        toView(row, isAdmin, canViewAccount(user, row))
      ),
    });
  } catch (error) {
    return serverError(error, "Данс уншихад алдаа гарлаа");
  }
}

type Fields = {
  title: string;
  number: string;
  bank: string;
  holder: string;
  isTithe: boolean;
  allowedUids: string[];
  allowedAimags: string[];
};

type FieldResult =
  | { ok: true; value: Partial<Fields> }
  | { ok: false; error: string };

/** Бичих талбаруудыг шалгана. `partial` үед өгөгдсөнийг нь л шалгана. */
function readFields(body: unknown, partial: boolean): FieldResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Өгөгдөл буруу байна." };
  }

  const input = body as Record<string, unknown>;
  const value: Partial<Fields> = {};

  if (input.title !== undefined || !partial) {
    const title = String(input.title ?? "").trim();
    if (!title) return { ok: false, error: "Дансны нэрийг бөглөнө үү." };
    if (title.length > MAX_TEXT) {
      return { ok: false, error: "Дансны нэр хэт урт байна." };
    }
    value.title = title;
  }

  if (input.number !== undefined || !partial) {
    // Зай, зураасыг цэвэрлэнэ — хүн хуулж буулгахад янз бүрээр ордог, гэтэл
    // гүйлгээ нь энэ утгаар холбогддог тул яг таарах ёстой
    const number = String(input.number ?? "")
      .replace(/[\s-]/g, "")
      .toUpperCase();

    if (!number) return { ok: false, error: "Дансны дугаарыг бөглөнө үү." };
    if (number.length > MAX_NUMBER) {
      return { ok: false, error: "Дансны дугаар хэт урт байна." };
    }
    value.number = number;
  }

  if (input.bank !== undefined || !partial) {
    const bank = String(input.bank ?? "");
    if (bank !== "" && !isBank(bank)) {
      return { ok: false, error: "Банк буруу байна." };
    }
    value.bank = bank;
  }

  if (input.holder !== undefined || !partial) {
    value.holder = String(input.holder ?? "")
      .trim()
      .slice(0, MAX_TEXT);
  }

  if (input.isTithe !== undefined) {
    if (typeof input.isTithe !== "boolean") {
      return { ok: false, error: "isTithe нь true/false байна." };
    }
    value.isTithe = input.isTithe;
  }

  if (input.allowedUids !== undefined) {
    if (
      !Array.isArray(input.allowedUids) ||
      input.allowedUids.some((uid) => typeof uid !== "string")
    ) {
      return { ok: false, error: "Эрхтэй хэрэглэгчид буруу байна." };
    }
    value.allowedUids = [...new Set(input.allowedUids as string[])];
  }

  if (input.allowedAimags !== undefined) {
    if (
      !Array.isArray(input.allowedAimags) ||
      input.allowedAimags.some((item) => !isValidOption(aimags, String(item)))
    ) {
      return { ok: false, error: "Эрхтэй аймаг буруу байна." };
    }
    value.allowedAimags = [...new Set(input.allowedAimags as string[])];
  }

  return { ok: true, value };
}

/**
 * «1/10» тэмдгийг зөвхөн нэг данс дээр үлдээнэ.
 *
 * Хоёр данс тэмдэглэгдвэл /tithe хуудас алийг нь сонгохоо мэдэхгүй болно.
 */
async function clearOtherTithe(keepId: string) {
  await db
    .update(donationAccounts)
    .set({ isTithe: false, updatedAt: new Date() })
    .where(ne(donationAccounts.id, keepId));
}

/** Шинэ данс нэмнэ (зөвхөн админ). */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const parsed = readFields(await request.json(), false);
    if (!parsed.ok) return badRequest(parsed.error);

    // Хамгийн ард нь тавина
    const rows = await readDonationAccounts();
    const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;

    // Postgres дээр энэ нь `onConflictDoNothing(number).returning()` байсан:
    // давхардвал хоосон буцаад 400 өгдөг байв. MySQL-д INSERT ... RETURNING
    // байхгүй тул давхардлыг урьдчилан шалгана. Дугаар дээрх unique индекс
    // хэвээр тул зэрэг бичих гэсэн тохиолдолд ч сан хамгаална.
    const [duplicate] = await db
      .select({ id: donationAccounts.id })
      .from(donationAccounts)
      .where(eq(donationAccounts.number, parsed.value.number!))
      .limit(1);

    if (duplicate) return badRequest("Ийм дугаартай данс бүртгэгдсэн байна.");

    const newId = crypto.randomUUID();

    await db.insert(donationAccounts).values({
      id: newId,
      title: parsed.value.title!,
      number: parsed.value.number!,
      bank: parsed.value.bank ?? "",
      holder: parsed.value.holder ?? "",
      isTithe: parsed.value.isTithe ?? false,
      allowedUids: parsed.value.allowedUids ?? [],
      allowedAimags: parsed.value.allowedAimags ?? [],
      position,
    });

    const [created] = await db
      .select()
      .from(donationAccounts)
      .where(eq(donationAccounts.id, newId));

    if (created.isTithe) await clearOtherTithe(created.id);

    return NextResponse.json({ account: toView(created, true, true) });
  } catch (error) {
    return serverError(error, "Данс нэмэхэд алдаа гарлаа");
  }
}

/** Данс засна — `?id=` заавал (зөвхөн админ). */
export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Засах дансыг заагаагүй байна.");

  try {
    const parsed = readFields(await request.json(), true);
    if (!parsed.ok) return badRequest(parsed.error);

    if (Object.keys(parsed.value).length === 0) {
      return badRequest("Өөрчлөх талбар заагаагүй байна.");
    }

    // MySQL нь UPDATE ... RETURNING дэмждэггүй — засаад буцааж уншина
    await db
      .update(donationAccounts)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(donationAccounts.id, id));

    const [updated] = await db
      .select()
      .from(donationAccounts)
      .where(eq(donationAccounts.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json({ error: "Данс олдсонгүй." }, { status: 404 });
    }

    if (updated.isTithe) await clearOtherTithe(updated.id);

    return NextResponse.json({ account: toView(updated, true, true) });
  } catch (error) {
    return serverError(error, "Данс засахад алдаа гарлаа");
  }
}

/**
 * Данс устгана — `?id=` заавал (зөвхөн админ).
 *
 * Гүйлгээ нь дансны ДУГААРААР холбогддог (гадаад түлхүүргүй) тул устгасан ч
 * түүх алдагдахгүй — зөвхөн жагсаалтаас алга болно.
 */
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return badRequest("Устгах дансыг заагаагүй байна.");

  try {
    // MySQL нь DELETE ... RETURNING дэмждэггүй — эхлээд байгаа эсэхийг шалгана
    const [existing] = await db
      .select({ id: donationAccounts.id })
      .from(donationAccounts)
      .where(eq(donationAccounts.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Данс олдсонгүй." }, { status: 404 });
    }

    await db.delete(donationAccounts).where(eq(donationAccounts.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Данс устгахад алдаа гарлаа");
  }
}
