import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import WelfareMap from "@/components/welfare/WelfareMap";

export const metadata: Metadata = {
  title: "Халамж | ББУЧ",
  description: "Халамжийн үйлчлэл",
};

/** Тахилт → Халамж. Энэ хэсэг нь бүх аймагт адилхан (нэг л сан). */
export default function PraiseTahiltWelfarePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Халамж
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Халамжид хамрагдсан өрхүүд, үзүүлсэн тусламжийн бүртгэл
        </p>
      </div>

      <AimagGuard aimag="praise">
        <WelfareMap />
      </AimagGuard>
    </div>
  );
}
