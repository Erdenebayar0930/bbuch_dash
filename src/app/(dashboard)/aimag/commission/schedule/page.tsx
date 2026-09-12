import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import ScheduleTabs from "@/components/schedule/ScheduleTabs";

export const metadata: Metadata = {
  title: "Хуваарь | ББУЧ",
  description: "Мод услах, дулаанхааны ээлжийн хуваарь",
};

export default function CommissionSchedulePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Хуваарь
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Ээлжийн хуваарь, гүйцэтгэлийн бүртгэл
        </p>
      </div>

      <AimagGuard aimag="commission">
        <ScheduleTabs />
      </AimagGuard>
    </div>
  );
}
