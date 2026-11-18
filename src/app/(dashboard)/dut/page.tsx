import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import PostFeed from "@/components/posts/PostFeed";

export const metadata: Metadata = {
  title: "Д.У.Т | ББУЧ",
  description: "Д.У.Т — нийтлэлүүд",
};

/**
 * «Д.У.Т» — эрх олгосон хүнд л нээгдэх нийтлэлийн самбар (`board = dut`).
 * Админ хэрэглэгчийн «Чуулганы мэдээлэл»-д «Д.У.Т» харьяаллыг олгоно; API нь
 * мөн `requireAimag("dut")`-аар шалгана (@see data/postOptions.ts RESTRICTED_BOARDS).
 */
export default function DutPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Д.У.Т</h1>

      <AimagGuard aimag="dut">
        <PostFeed board="dut" />
      </AimagGuard>
    </div>
  );
}
