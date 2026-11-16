import { Metadata } from "next";

import SupplyTabs from "@/components/finance/SupplyTabs";

export const metadata: Metadata = {
  title: "Хангамж | ББУЧ",
  description: "Чуулганы хангамж, төсөв",
};

/**
 * Санхүү → Хангамж. Табууд: «Хангамжийн талаар», «Чуулганы хангамж» (орж
 * ирсэн мөнгө, эд зүйлсийн бүртгэл), «Чуулганы төсөв».
 *
 * Хуудас нь бүгдэд нээлттэй; таб бүрийн эрхийг `SupplyTabs` шийднэ.
 */
export default function FinanceSupplyPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Хангамж</h1>

      <SupplyTabs />
    </div>
  );
}
