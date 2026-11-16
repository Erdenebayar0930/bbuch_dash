import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import SupplyTabs from "@/components/finance/SupplyTabs";

export const metadata: Metadata = {
  title: "Хангамж | ББУЧ",
  description: "Чуулганы хангамж, төсөв",
};

/**
 * Санхүү → Хангамж. Табууд: «Хангамжийн талаар», «Чуулганы хангамж» (орж
 * ирсэн мөнгө, эд зүйлсийн бүртгэл), «Чуулганы төсөв», «Сахилгажуулалт».
 *
 * Зөвхөн админ, супер админ ба Хангамжийн аймагт — цэс нуух нь хаягаар орохоос
 * сэргийлэхгүй тул хуудас өөрөө `AimagGuard`-аар шалгана (API нь `requireAimag`).
 */
export default function FinanceSupplyPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Хангамж</h1>

      <AimagGuard aimag="supply">
        <SupplyTabs />
      </AimagGuard>
    </div>
  );
}
