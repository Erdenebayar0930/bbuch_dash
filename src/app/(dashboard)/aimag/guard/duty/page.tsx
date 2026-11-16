import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Харуулын үүрэгт зогсох | ББУЧ",
  description: "Харуулын аймгийн үүрэг, заавар — нийтлэлүүд",
};

/**
 * Харуулын аймгийн «Харуулын үүрэгт зогсох» — нийтлэлийн самбар (бичвэр, зураг,
 * бичлэг, файл). Бусад нийтлэлийн самбартай ижил, `board = guard-duty`.
 */
export default function GuardDutyPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Харуулын үүрэгт зогсох</h1>

      <AimagGuard aimag="guard">
        <PostFeed board="guard-duty" />
      </AimagGuard>
    </div>
  );
}
