import { and, asc, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireCoder,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetCategories, assetNames, assets, warehouses } from "@/lib/db/schema";

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

/** Нэрийг харьцуулах — том жижиг үсэг, илүү зайг үл тооно («аяга  таваг» = «Аяга таваг») */
const sameName = (table: (typeof tables)[Kind], name: string) =>
  sql`lower(regexp_replace(trim(${table.name}), '[[:space:]]+', ' ', 'g')) = lower(regexp_replace(trim(${name}), '[[:space:]]+', ' ', 'g'))`;

/**
 * Тухайн Байршлын ангилал / Төрөл / Нэрийг хэдэн эд хөрөнгө ашиглаж байна.
 * Ашиглагдаж буй бол кодын багц (үсэг) нь түгжээтэй, устгах боломжгүй.
 */
async function usageCount(kind: Kind, id: string, name: string): Promise<number> {
  const where =
    kind === "warehouse"
      ? eq(assets.warehouseId, id)
      : kind === "category"
        ? eq(assets.categoryId, id)
        : eq(assets.name, name);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(assets).where(where);
  return row?.n ?? 0;
}

/** Аль хүснэгтэд бичихийг заана */
const tables = {
  warehouse: warehouses,
  category: assetCategories,
  name: assetNames,
} as const;

type Kind = keyof typeof tables;

const isKind = (value: unknown): value is Kind =>
  value === "warehouse" || value === "category" || value === "name";

/** Агуулах ба төрлийн жагсаалт — маягт дүүргэхэд хэрэгтэй. */
export async function GET(request: NextRequest) {
  const result = await requireActiveUser(request);
  if ("error" in result) return result.error;

  try {
    const [warehouseRows, categoryRows, nameRows] = await Promise.all([
      db.select().from(warehouses).orderBy(asc(warehouses.position)),
      db.select().from(assetCategories).orderBy(asc(assetCategories.position)),
      db.select().from(assetNames).orderBy(asc(assetNames.position)),
    ]);

    return NextResponse.json({
      warehouses: warehouseRows,
      categories: categoryRows,
      names: nameRows,
    });
  } catch (error) {
    return serverError(error, "Лавлах жагсаалт уншихад алдаа гарлаа");
  }
}

/**
 * Шинэ Байршлын ангилал, Төрөл эсвэл Нэр нэмнэ — Кодчилол удирдах эрхтэй
 * хүн (админ, эсвэл админаас `canCode` эрх авсан).
 * Эрэмбийг сүүлд нь тавина — одоо байгаа дараалал өөрчлөгдөхгүй.
 */
export async function POST(request: NextRequest) {
  const result = await requireCoder(request);
  if ("error" in result) return result.error;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const kind = body.kind;
    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse", "category" эсвэл "name" байна.');
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
      .where(sameName(table, name))
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
 * Байршлын ангилал, Төрөл, Нэрийн нэр ба/эсвэл кодчиллын үсгийг засна
 * (Кодчилол удирдах эрхтэй хүн). Эд хөрөнгө ашиглаж буй
 * (бүртгэлтэй) бол нэр, үсэг хоёулаа түгжээтэй.
 */
export async function PATCH(request: NextRequest) {
  const result = await requireCoder(request);
  if ("error" in result) return result.error;

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const kind = body.kind;
    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse", "category" эсвэл "name" байна.');
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return badRequest("id шаардлагатай.");

    const table = tables[kind];
    const [existing] = await db
      .select({ id: table.id, name: table.name, codeLetter: table.codeLetter })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    // Ирсэн талбаруудыг л солино — нэр, үсэг хоёулаа заавал биш
    const patch: { name?: string; codeLetter?: string } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return badRequest("Нэрийг оруулна уу.");
      if (name.length > MAX_NAME) {
        return badRequest(`Нэр ${MAX_NAME} тэмдэгтээс урт байж болохгүй.`);
      }
      const [duplicate] = await db
        .select({ id: table.id })
        .from(table)
        .where(and(sameName(table, name), ne(table.id, id)))
        .limit(1);
      if (duplicate) return badRequest(`"${name}" аль хэдийн бүртгэгдсэн байна.`);
      if (name !== existing.name) {
        // Бүртгэлтэй (эд хөрөнгө ашиглаж буй) бол нэр солигдохгүй
        const used = await usageCount(kind, id, existing.name);
        if (used > 0) {
          return badRequest(
            `«${existing.name}»-г ${used} эд хөрөнгө ашиглаж байгаа тул нэрийг өөрчлөх боломжгүй.`
          );
        }
      }
      patch.name = name;
    }

    if (body.codeLetter !== undefined) {
      const parsed = await parseCodeLetter(kind, body.codeLetter, id);
      if ("error" in parsed) return badRequest(parsed.error);
      if (parsed.letter !== existing.codeLetter) {
        const used = await usageCount(kind, id, existing.name);
        if (used > 0) {
          return badRequest(
            `«${existing.name}»-г ${used} эд хөрөнгө ашиглаж байгаа тул үсгийг (кодын багц) өөрчлөх боломжгүй.`
          );
        }
      }
      patch.codeLetter = parsed.letter;
    }

    if (Object.keys(patch).length === 0) return badRequest("Өөрчлөх талбар алга.");

    await db.update(table).set(patch).where(eq(table.id, id));

    const [updated] = await db.select().from(table).where(eq(table.id, id));

    return NextResponse.json({ item: updated });
  } catch (error) {
    return serverError(error, "Хадгалахад алдаа гарлаа");
  }
}

/**
 * Байршлын ангилал, Төрөл эсвэл Нэрийг устгана (Кодчилол удирдах эрхтэй хүн).
 * Эд хөрөнгө ашиглаж буй бол устгахгүй (кодын багц түгжээтэй).
 */
export async function DELETE(request: NextRequest) {
  const result = await requireCoder(request);
  if ("error" in result) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");

    if (!isKind(kind)) {
      return badRequest('kind нь "warehouse", "category" эсвэл "name" байна.');
    }
    if (!id) return badRequest("id шаардлагатай.");

    const table = tables[kind];

    // MySQL нь DELETE ... RETURNING дэмждэггүй тул эхлээд байгаа эсэхийг
    // шалгаад дараа нь устгана.
    const [existing] = await db
      .select({ id: table.id, name: table.name })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    // Ашиглагдаж буй кодын багцыг устгахгүй — кодууд нь утгаа алдана
    const used = await usageCount(kind, id, existing.name);
    if (used > 0) {
      return badRequest(`«${existing.name}»-г ${used} эд хөрөнгө ашиглаж байгаа тул устгах боломжгүй.`);
    }

    await db.delete(table).where(eq(table.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Устгахад алдаа гарлаа");
  }
}
