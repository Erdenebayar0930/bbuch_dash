import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdmin, serverError } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { handbookDocuments } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Баримтыг устгана (зөвхөн админ).
 *
 * Storage дахь файлыг эндээс УСТГАХГҮЙ — клиент эхлээд DB мөрийг устгаад,
 * дараа нь Storage объектыг өөрөө устгана (activeAdmin() дүрэм шаарддаг тул
 * зөвхөн клиент талд Firebase Auth токентой хийж чадна).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;

  const { id } = await context.params;

  try {
    const [existing] = await db
      .select({ id: handbookDocuments.id, filePath: handbookDocuments.filePath })
      .from(handbookDocuments)
      .where(eq(handbookDocuments.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Олдсонгүй." }, { status: 404 });
    }

    await db.delete(handbookDocuments).where(eq(handbookDocuments.id, id));

    return NextResponse.json({ ok: true, filePath: existing.filePath });
  } catch (error) {
    return serverError(error, "Баримт устгахад алдаа гарлаа");
  }
}
