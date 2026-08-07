import { Metadata } from "next";

import TaskBoard from "@/components/tasks/TaskBoard";

export const metadata: Metadata = {
  title: "Ажлууд | ББУЧ",
  description: "Хуваарилагдсан ажил, даалгаврууд",
};

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Ажлууд
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Төслөөр бүлэглэсэн ажлын даалгавар — картыг чирж (утсан дээр дараад
          барихад) төлөвийг өөрчилнө
        </p>
      </div>

      <TaskBoard />
    </div>
  );
}
