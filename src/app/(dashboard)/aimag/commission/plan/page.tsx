import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata: Metadata = {
  title: "Төлөвлөгөө | ББУЧ",
  description: "Агуу захирамжийн аймгийн төсөл, ажлын даалгавар",
};

export default function CommissionPlanPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Төлөвлөгөө
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Төслөөр бүлэглэсэн ажлын даалгавар
        </p>
      </div>

      <AimagGuard aimag="commission">
        <TaskBoard aimagFilter="commission" />
      </AimagGuard>
    </div>
  );
}
