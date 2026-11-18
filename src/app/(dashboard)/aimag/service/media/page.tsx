import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Медиа | ББУЧ",
  description: "Туслах үйлчлэх аймгийн Медиа — нийтлэлүүд",
};

/**
 * Туслах үйлчлэх аймгийн «Медиа» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = service-media`.
 */
export default function ServiceMediaPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Медиа</h1>

      <AimagGuard aimag="service">
        <PostFeed board="service-media" />
      </AimagGuard>
    </div>
  );
}
