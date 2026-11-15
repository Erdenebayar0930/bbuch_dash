import "server-only";

import {
  revelations,
  tahiltRevelations,
  tahiltWelfareAids,
  tahiltWelfareHouseholds,
  welfareAids,
  welfareHouseholds,
} from "@/lib/db/schema";

import type { NextRequest } from "next/server";

/**
 * Тахилтын цэсийн өгөгдөл `tahilt` schema-д, бусад нь `public`-д хадгалагдана.
 * Хүснэгтүүд нь ЯГ ижил баганатай (schema.ts дахь `...Fields()` функцүүд)
 * тул нэг route хоёуланд ажиллана — энэ файл аль хүснэгтийг авахыг шийднэ.
 *
 * Төрлийн хөрвүүлэлт (`as unknown as`) нь аюулгүй: баганууд нь нэг
 * функцээс үүссэн тул ялгаа нь зөвхөн хүснэгтийн нэр. drizzle нь SQL-ийг
 * ажиллах үед объектын жинхэнэ нэр, schema-аас бүтээдэг тул
 * `"tahilt"."welfare_households"` зөв гарна.
 */

export type DataBoard = "main" | "tahilt";

/** `?board=tahilt` → Тахилтын хүснэгт, бусад үед үндсэн */
export const boardOf = (request: NextRequest): DataBoard =>
  request.nextUrl.searchParams.get("board") === "tahilt" ? "tahilt" : "main";

export function welfareTables(board: DataBoard) {
  return board === "tahilt"
    ? {
        households: tahiltWelfareHouseholds as unknown as typeof welfareHouseholds,
        aids: tahiltWelfareAids as unknown as typeof welfareAids,
      }
    : { households: welfareHouseholds, aids: welfareAids };
}

/** Илчлэлийн хүснэгт — Тахилтынх `tahilt.revelations`, бусад аймгийнх `public` */
export const revelationTable = (aimag: string) =>
  aimag === "tahilt"
    ? (tahiltRevelations as unknown as typeof revelations)
    : revelations;
