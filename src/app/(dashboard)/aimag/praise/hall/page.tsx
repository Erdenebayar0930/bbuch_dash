import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Асрын үйлчлэл | ББУЧ",
  description: "Магтаалын аймгийн Асрын үйлчлэл — нийтлэлүүд",
};

/**
 * Магтаалын аймгийн «Асрын үйлчлэл» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = praise-hall`.
 */
export default function PraiseHallPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Асрын үйлчлэл</h1>

      <AimagGuard aimag="praise">
        <PostFeed board="praise-hall" />
      </AimagGuard>
    </div>
  );
}
