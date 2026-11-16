import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Туслах үйлчлэлүүд | ББУЧ",
  description: "Туслах үйлчлэх аймгийн Туслах үйлчлэлүүд — нийтлэлүүд",
};

/**
 * Туслах үйлчлэх аймгийн «Туслах үйлчлэлүүд» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = service-services`.
 */
export default function ServiceServicesPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Туслах үйлчлэлүүд</h1>

      <AimagGuard aimag="service">
        <PostFeed board="service-services" />
      </AimagGuard>
    </div>
  );
}
