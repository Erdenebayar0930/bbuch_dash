import { Metadata } from "next";

import AimagGuard from "@/components/AimagGuard";
import SectionTabs from "@/components/tahilt/SectionTabs";

export const metadata: Metadata = {
  title: "Итгэгчид | ББУЧ",
  description: "Тахилт дахь чуулганы итгэгчид",
};

/** Тахилт → Тахилт дахь чуулган → Итгэгчид. Насанд хүрэгсэд, Өсвөр, Хүүхэд нь таб. */
export default function TahiltBelieversPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Итгэгчид</h1>

      <AimagGuard aimag="tahilt">
        <SectionTabs
          label="Итгэгчид"
          tabs={[
            { key: "adults", label: "Насанд хүрэгсэд", description: "Насанд хүрэгсэд итгэгчид" },
            { key: "youth", label: "Өсвөр", description: "Өсвөр үеийн итгэгчид" },
            { key: "children", label: "Хүүхэд", description: "Хүүхэд итгэгчид" },
          ]}
        />
      </AimagGuard>
    </div>
  );
}
