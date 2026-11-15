import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata: Metadata = {
  title: "Тушаал | ББУЧ",
  description: "Тахилтын тушаал, ажлын даалгавар",
};

/**
 * Тахилтын «Тушаал» — бусад аймгийн Төлөвлөгөөнөөс тусдаа самбар
 * (`tahilt_commands`, `tahilt_tasks` хүснэгт).
 */
export default function TahiltCommandsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Тушаал</h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Тахилтын тушаалаар бүлэглэсэн ажлын даалгавар
        </p>
      </div>

      <AimagGuard aimag="tahilt">
        <TaskBoard board="tahilt" aimagFilter="tahilt" />
      </AimagGuard>
    </div>
  );
}
