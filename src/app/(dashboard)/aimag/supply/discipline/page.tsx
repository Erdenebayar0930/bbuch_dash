import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import DisciplinePanel from "@/components/finance/DisciplinePanel";

/** profileOptions доторх түлхүүр — `/api/discipline` нь `requireAimag("supply")` */
const AIMAG = "supply";

export const metadata: Metadata = {
  title: "Хангамжийн аймаг — Сахилгажуулалтын төлбөр | ББУЧ",
  description: "Хангамжийн аймгийн гишүүдийн сар бүрийн сахилгажуулалтын төлбөр",
};

/**
 * Хангамжийн аймаг → Сахилгажуулалтын төлбөр. Аймгийнхан сар бүр тогтмол
 * дүн төлж, сонгогдсон чагтлагч тэмдэглэнэ (@see DisciplinePanel).
 */
export default function SupplyDisciplinePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Сахилгажуулалтын төлбөр
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хангамжийн аймгийн гишүүдийн сар бүрийн төлбөр
        </p>
      </div>

      <AimagGuard aimag={AIMAG}>
        <DisciplinePanel />
      </AimagGuard>
    </div>
  );
}
