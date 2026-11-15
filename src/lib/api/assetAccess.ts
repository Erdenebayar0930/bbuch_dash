import "server-only";

import { eq } from "drizzle-orm";

import { forbidden, isAdminRole, requireAimag } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";

import type { NextRequest } from "next/server";

/** Эд хөрөнгийн бүртгэлийг Магтаалын аймаг хөтөлнө */
export const ASSET_AIMAG = "praise";

/**
 * Эд хөрөнгө нэмэх, засах, зураг, шалгалт бүртгэх эрх — админ эсвэл
 * Магтаалын аймгийн гишүүн. Устгах нь зөвхөн админд (тэр route-ууд
 * `requireAdmin` хэвээр).
 *
 * `assetId` өгвөл админ бус хүнд тухайн хөрөнгө Магтаалынх эсэхийг шалгана —
 * өөр аймгийн бүртгэлийг засахаас сэргийлнэ.
 */
export async function requireAssetEditor(request: NextRequest, assetId?: string) {
  const result = await requireAimag(request, ASSET_AIMAG);
  if ("error" in result) return result;

  if (assetId && !isAdminRole(result.caller.user?.role)) {
    const [asset] = await db
      .select({ aimag: assets.aimag })
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    // Олдохгүй бол route өөрөө 404 буцаана
    if (asset && asset.aimag !== ASSET_AIMAG) {
      return { error: forbidden("Зөвхөн Магтаалын аймгийн эд хөрөнгийг засна.") } as const;
    }
  }

  return result;
}
