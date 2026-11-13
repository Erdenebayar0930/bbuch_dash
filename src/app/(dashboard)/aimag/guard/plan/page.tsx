import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata: Metadata = {
  title: "Төлөвлөгөө | ББУЧ",
  description: "Бүх аймгийн тушаал, ажлын даалгавар",
};

/**
 * Харуулын аймгийн төлөвлөгөө — бусад аймгаас ялгаатай нь БҮХ аймгийн
 * тушаал, даалгаврыг нэг самбарт харуулна (`aimagFilter`-гүй). Сервер тал
 * `canSeeAllPlans`-аар Харуулын гишүүдэд бүх мөрийг буцаадаг.
 */
export default function GuardPlanPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Төлөвлөгөө
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Бүх аймгийн тушаалаар бүлэглэсэн ажлын даалгавар
        </p>
      </div>

      <AimagGuard aimag="guard">
        <TaskBoard />
      </AimagGuard>
    </div>
  );
}
