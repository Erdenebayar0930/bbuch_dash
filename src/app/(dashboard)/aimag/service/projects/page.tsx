import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Төслүүд | ББУЧ",
  description: "Туслах үйлчлэх аймгийн Төслүүд — нийтлэлүүд",
};

/**
 * Туслах үйлчлэх аймгийн «Төслүүд» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = service-projects`.
 */
export default function ServiceProjectsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Төслүүд</h1>

      <AimagGuard aimag="service">
        <PostFeed board="service-projects" />
      </AimagGuard>
    </div>
  );
}
