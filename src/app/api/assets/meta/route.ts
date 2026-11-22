import { and, asc, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  requireAimag,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetCategories, warehouses } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 60;
const MAX_LETTER = 8;

/**
 * Кодчиллын үсэг — Байршлын ангилалд эхний, Төрөлд 2 дахь үсэг. Хоосон
 * байж болно. Нэг төрөлдөө (байршил эсвэл төрөл) давтагдахгүй — эс бөгөөс
 * код давхцана. Том үсгээр хадгална.
 */
async function parseCodeLetter(
  kind: Kind,
  value: unknown,
  exceptId?: string
): Promise<{ letter: string } | { error: string }> {
  const letter = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (letter.length > MAX_LETTER) {
    return { error: `Үсэг ${MAX_LETTER} тэмдэгтээс урт байж болохгүй.` };
  }
  if (!letter) return { letter };
  if (/\d$/.test(letter)) return { error: "Үсэг нь тоогоор төгсөж болохгүй." };
  const table = tables[kind];
  const [taken] = await db
    .select({ name: table.name })
    .from(table)
    .where(
      exceptId
        ? and(eq(table.codeLetter, letter), ne(table.id, exceptId))
        : eq(table.codeLetter, letter)
    )
    .limit(1);
  if (taken) return { error: `"${letter}" үсгийг "${taken.name}" ашиглаж байна.` };
  return { letter };
}

/** Аль хүснэгтэд бичихийг заана */
const tables = {
  warehouse: warehouses,
  category: assetCategories,
} as const;

type Kind = keyof typeof tables;

const isKind = (value: unknown): value is Kind =>
  value === "warehouse" || value === "category";

/** Агуулах ба төрлийн жагсаалт — маягт дүүргэхэд хэрэгтэй. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const [warehouseRows, categoryRows] = await Promise.all([
      db.select().from(warehouses).orderBy(asc(warehouses.position)),
      db.select().from(assetCategories).orderBy(asc(assetCategories.position)),
    ]);

    return NextResponse.json({
      warehouses: warehouseRows,
      categories: categoryRows,
    });
  } catch (error) {
    return serverError(error, "Лавлах жагсаалт уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ агуулах эсвэл төрөл нэмнэ (админ болон Магтаалын аймгийн гишүүд —
 * эд хөрөнгийн бүртгэл өөр аймагт нээгдвэл энд мөн нэмэх шаардлагатай).
 * Эрэмбийг сүүлд нь тавина — одоо байгаа дараалал өөрчлөгдөхгүй.
 */
export async function POST(request: NextRequest) {
  const result = await requireAimag(request, "praise");
  if ("error" in result) return result.error;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const kind = body.kind;
    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse" эсвэл "category" байна.');
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) return badRequest("Нэрийг оруулна уу.");
    if (name.length > MAX_NAME) {
      return badRequest(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
    }

    const table = tables[kind];

    const [duplicate] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.name, name))
      .limit(1);

    if (duplicate) return badRequest(`"${name}" аль хэдийн бүртгэгдсэн байна.`);

    const parsedLetter = await parseCodeLetter(kind, body.codeLetter);
    if ("error" in parsedLetter) return badRequest(parsedLetter.error);
    const codeLetter = parsedLetter.letter;

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${table.position}), -1) + 1` })
      .from(table);

    // MySQL нь INSERT ... RETURNING дэмждэггүй — ID-г урьдчилж үүсгэнэ
    const newId = crypto.randomUUID();

    await db.insert(table).values({ id: newId, name, position: next, codeLetter });

    const [created] = await db
      .select()
      .from(table)
      .where(eq(table.id, newId));

    return NextResponse.json({ item: created });
  } catch (error) {
    return serverError(error, "Нэмэхэд алдаа гарлаа");
  }
}

/**
 * Кодчилол — Байршлын ангилал эсвэл Төрлийн үсгийг солино (нэмэх эрхтэй
 * адил: админ болон Магтаалын аймгийн гишүүд). Бүртгэсэн кодууд өөрчлөгдөхгүй.
 */
export async function PATCH(request: NextRequest) {
  const result = await requireAimag(request, "praise");
  if ("error" in result) return result.error;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const kind = body.kind;
    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse" эсвэл "category" байна.');
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return badRequest("id шаардлагатай.");

    const parsed = await parseCodeLetter(kind, body.codeLetter, id);
    if ("error" in parsed) return badRequest(parsed.error);

    const table = tables[kind];
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.update(table).set({ codeLetter: parsed.letter }).where(eq(table.id, id));

    const [updated] = await db.select().from(table).where(eq(table.id, id));

    return NextResponse.json({ item: updated });
  } catch (error) {
    return serverError(error, "Үсэг хадгалахад алдаа гарлаа");
  }
}

/**
 * Агуулах эсвэл төрлийг устгана (зөвхөн админ, супер админ — устгах эрх
 * системийн хэмжээнд зөвхөн тэдэнд байна; нэмэхийг аймгийн гишүүд хийнэ).
 * Холбогдох эд хөрөнгийн мөр УСТАХГҮЙ — тухайн талбар нь хоосон болно.
 */
export async function DELETE(request: NextRequest) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");

    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse" эсвэл "category" байна.');
    }
    if (!id) return badRequest("id шаардлагатай.");

    const table = tables[kind];

    // MySQL нь DELETE ... RETURNING дэмждэггүй тул эхлээд байгаа эсэхийг
    // шалгаад дараа нь устгана.
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.delete(table).where(eq(table.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Устгахад алдаа гарлаа");
  }
}
