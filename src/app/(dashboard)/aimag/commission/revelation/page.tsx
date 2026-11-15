import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import RevelationFeed from "@/components/revelation/RevelationFeed";

export const metadata: Metadata = {
  title: "Илчлэл | ББУЧ",
  description: "Аймгийн илчлэлийн нийтлэлүүд",
};

export default function CommissionRevelationPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Илчлэл</h1>

      <AimagGuard aimag="commission">
        <RevelationFeed aimag="commission" />
      </AimagGuard>
    </div>
  );
}
