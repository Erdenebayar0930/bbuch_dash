import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Хаанчлалын хангамж | ББУЧ",
  description: "Хангамжийн аймгийн Хаанчлалын хангамж — нийтлэлүүд",
};

/**
 * Хангамжийн аймгийн «Хаанчлалын хангамж» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = supply-kingdom`.
 */
export default function SupplyKingdomPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Хаанчлалын хангамж</h1>

      <AimagGuard aimag="supply">
        <PostFeed board="supply-kingdom" />
      </AimagGuard>
    </div>
  );
}
