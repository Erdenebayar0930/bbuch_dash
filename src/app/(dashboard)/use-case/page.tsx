import { Metadata } from "next";

import UseCaseDiagram from "@/components/usecase/UseCaseDiagram";

export const metadata: Metadata = {
  title: "Use case | ББУЧ",
  description: "Системийн оролцогчид ба тэдний хийж болох үйлдлүүд",
};

export default function UseCasePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Системийн use case
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хэн юу хийж чадах вэ — оролцогч ба модулиудын зураглал
        </p>
      </div>

      <UseCaseDiagram />
    </div>
  );
}
