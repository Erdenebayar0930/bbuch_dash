import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import ScheduleBoard from "@/components/schedule/ScheduleBoard";

export const metadata: Metadata = {
  title: "Дулаанхаан | ББУЧ",
  description: "Дулаанхааны ажлын хуваарь",
};

export default function DulaankhaanPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Дулаанхаан
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Ажлын ээлжийн хуваарь, гүйцэтгэлийн бүртгэл
        </p>
      </div>

      <AimagGuard aimag="commission">
        <ScheduleBoard kind="dulaankhaan" />
      </AimagGuard>
    </div>
  );
}
