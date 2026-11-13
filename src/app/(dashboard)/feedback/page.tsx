import { Metadata } from "next";

import FeedbackBoard from "@/components/feedback/FeedbackBoard";

export const metadata: Metadata = {
  title: "Санал хүсэлт | ББУЧ",
  description: "Системийн талаарх санал хүсэлт, түүний явц",
};

export default function FeedbackPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Санал хүсэлт
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Санал хүсэлтээ бичиж илгээгээрэй — бүх санал явцынхаа хамт энд харагдана.
        </p>
      </div>

      <FeedbackBoard />
    </div>
  );
}
