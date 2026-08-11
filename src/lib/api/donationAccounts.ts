import "server-only";

import { asc } from "drizzle-orm";

import { seedDonationAccounts } from "@/data/donationAccounts";
import { db } from "@/lib/db";
import { donationAccounts } from "@/lib/db/schema";
import { isAdminRole } from "@/lib/permissions";

import type { DonationAccountRow, UserRow } from "@/lib/db/schema";

/**
 * Бүх хандивын данс, дараалалаараа.
 *
 * Хүснэгт хоосон бол чуулганы одоо ашиглаж буй данснуудыг нэг удаа суулгана —
 * шинэ суулгац дээр Санхүү хэсэг хоосон харагдах ёсгүй. Суусны дараа админ
 * өөрөө удирдана.
 */
export async function readDonationAccounts(): Promise<DonationAccountRow[]> {
  const rows = await db
    .select()
    .from(donationAccounts)
    .orderBy(asc(donationAccounts.position), asc(donationAccounts.title));

  if (rows.length > 0) return rows;

  await db
    .insert(donationAccounts)
    .values(
      seedDonationAccounts.map((item, index) => ({
        ...item,
        position: index,
      }))
    )
    .onConflictDoNothing();

  return db
    .select()
    .from(donationAccounts)
    .orderBy(asc(donationAccounts.position), asc(donationAccounts.title));
}

type AccessRule = Pick<DonationAccountRow, "allowedUids" | "allowedAimags">;

/**
 * Тухайн хэрэглэгч дансны ГҮЙЛГЭЭГ харж болох эсэх.
 *
 * Дансны карт нь бүгдэд нээлттэй — энэ нь зөвхөн доторх гүйлгээний тухай.
 *
 * Хоёр жагсаалт хоёулаа хоосон бол ХЯЗГААРЛАЛТ ТАВИАГҮЙ гэсэн үг тул бүх
 * идэвхтэй хэрэглэгч харна. Хаах бол ядаж нэг хүн эсвэл аймаг сонгоно.
 */
export function canViewAccount(
  user: UserRow | null,
  account: AccessRule
): boolean {
  if (isAdminRole(user?.role)) return true;

  const open =
    account.allowedUids.length === 0 && account.allowedAimags.length === 0;
  if (open) return true;

  if (!user) return false;
  if (account.allowedUids.includes(user.uid)) return true;

  // Аймгаар олгосон эрх — гишүүн нэмэгдэхэд өөрөө дагана
  return (user.aimags ?? []).some((aimag) =>
    account.allowedAimags.includes(aimag)
  );
}

/**
 * Хэрэглэгчийн харж болох дансны дугаарууд.
 *
 * Админд `null` буцаана — «хязгаарлалтгүй» гэсэн утгатай. Хоосон массив нь
 * «нэг ч данс харах эрхгүй» гэсэн үг тул хоёрыг ялгах шаардлагатай.
 */
export async function accessibleAccountNumbers(
  user: UserRow | null
): Promise<string[] | null> {
  if (isAdminRole(user?.role)) return null;

  const rows = await readDonationAccounts();

  return rows
    .filter((row) => canViewAccount(user, row))
    .map((row) => row.number);
}

/** Дугаар бүртгэлтэй данс мөн эсэх */
export async function isKnownAccount(value: string): Promise<boolean> {
  const rows = await readDonationAccounts();
  return rows.some((row) => row.number === value);
}
