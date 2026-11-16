import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "ААХ-ийн үйлчлэл | ББУЧ",
  description: "Агуу захирамжийн аймгийн ААХ-ийн үйлчлэл — нийтлэлүүд",
};

/**
 * Агуу захирамжийн аймгийн «ААХ-ийн үйлчлэл» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = commission-aah`.
 */
export default function CommissionAahPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">ААХ-ийн үйлчлэл</h1>

      <AimagGuard aimag="commission">
        <PostFeed board="commission-aah" />
      </AimagGuard>
    </div>
  );
}
