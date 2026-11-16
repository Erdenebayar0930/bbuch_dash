import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import CommandTabs from "@/components/tasks/CommandTabs";
import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata: Metadata = {
  title: "Тушаал | ББУЧ",
  description: "Магтаалын аймгийн тушаал, ажлын даалгавар",
};

export default function PraisePlanPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Тушаал
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Тушаалаар бүлэглэсэн ажлын даалгавар
        </p>
      </div>

      <AimagGuard aimag="praise">
        <CommandTabs aimag="praise" progress={<TaskBoard aimagFilter="praise" />} />
      </AimagGuard>
    </div>
  );
}
