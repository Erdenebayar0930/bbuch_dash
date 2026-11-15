import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import GospelRegistry from "@/components/gospel/GospelRegistry";

export const metadata: Metadata = {
  title: "Сайн мэдээ | ББУЧ",
  description: "Сайн мэдээ хүргэсэн хүмүүсийн бүртгэл",
};

/** Харуулын аймгийн «Сайн мэдээ» — бүртгэл нь гурван аймагт нэг л сан. */
export default function GuardGospelPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Сайн мэдээ
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Сайн мэдээ хүргэсэн хүмүүсийн бүртгэл
        </p>
      </div>

      <AimagGuard aimag="guard">
        <GospelRegistry aimag="guard" />
      </AimagGuard>
    </div>
  );
}
