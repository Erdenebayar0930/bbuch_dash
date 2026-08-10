import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PurchaseList from "@/components/supply/PurchaseList";

export const metadata: Metadata = {
  title: "Худалдан авах жагсаалт | ББУЧ",
  description: "Хангамжийн аймгийн худалдан авах хүсэлтүүд",
};

export default function PurchasesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Худалдан авах жагсаалт
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хэрэгцээт барааны хүсэлт, зөвшөөрөл, худалдан авалт
        </p>
      </div>

      <AimagGuard aimag="supply">
        <PurchaseList />
      </AimagGuard>
    </div>
  );
}
