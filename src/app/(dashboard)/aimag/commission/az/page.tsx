import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "АЗ-ийн үйлчлэл | ББУЧ",
  description: "Агуу захирамжийн аймгийн АЗ-ийн үйлчлэл — нийтлэлүүд",
};

/**
 * Агуу захирамжийн аймгийн «АЗ-ийн үйлчлэл» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = commission-az`.
 */
export default function CommissionAzPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">АЗ-ийн үйлчлэл</h1>

      <AimagGuard aimag="commission">
        <PostFeed board="commission-az" />
      </AimagGuard>
    </div>
  );
}
