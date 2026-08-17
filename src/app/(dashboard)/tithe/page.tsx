import { Metadata } from "next";

import TitheAllocation from "@/components/finance/TitheAllocation";

export const metadata: Metadata = {
  title: "Хуваарилалт | ББУЧ",
  description: "Цугласан 1/10 ба өргөлийн хуваарилалт",
};

export default function TithePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Хуваарилалт
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Цугласан өргөл хаашаа хуваарилагдсан
        </p>
      </div>

      <TitheAllocation />
    </div>
  );
}
