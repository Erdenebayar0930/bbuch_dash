import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import SectionTabs from "@/components/tahilt/SectionTabs";

export const metadata: Metadata = {
  title: "Цуглаан | ББУЧ",
  description: "Тахилт дахь чуулганы цуглаан",
};

/** Тахилт → Тахилт дахь чуулган → Цуглаан. Сургаал, Амралтын өдрийн үйлчлэл, Хүүхдийн цуглаан, Үйл явдал нь таб. */
export default function TahiltGatheringPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Цуглаан</h1>

      <AimagGuard aimag="tahilt">
        <SectionTabs
          label="Цуглаан"
          tabs={[
            { key: "teaching", label: "Сургаал", description: "Цуглааны сургаал" },
            {
              key: "sabbath",
              label: "Амралтын өдрийн үйлчлэл",
              description: "Амралтын өдрийн үйлчлэлийн хөтөлбөр",
            },
            {
              key: "children",
              label: "Хүүхдийн цуглаан",
              description: "Хүүхдийн цуглааны хөтөлбөр",
            },
            { key: "events", label: "Үйл явдал", description: "Цуглааны үйл явдал" },
          ]}
        />
      </AimagGuard>
    </div>
  );
}
