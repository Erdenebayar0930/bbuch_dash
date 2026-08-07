import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  badRequest,
  requireActiveUser,
  requireAdmin,
  serverError,
} from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assetCategories, warehouses } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 60;

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
 * Шинэ агуулах эсвэл төрөл нэмнэ (зөвхөн админ).
 * Эрэмбийг сүүлд нь тавина — одоо байгаа дараалал өөрчлөгдөхгүй.
 */
export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
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

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${table.position}), -1) + 1` })
      .from(table);

    const [created] = await db
      .insert(table)
      .values({ name, position: next })
      .returning();

    return NextResponse.json({ item: created });
  } catch (error) {
    return serverError(error, "Нэмэхэд алдаа гарлаа");
  }
}

/**
 * Агуулах эсвэл төрлийг устгана (зөвхөн админ).
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
    const [deleted] = await db
      .delete(table)
      .where(eq(table.id, id))
      .returning({ id: table.id });

    if (!deleted) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Устгахад алдаа гарлаа");
  }
}
