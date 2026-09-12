import StatementImport from "@/components/finance/StatementImport";

export default function AllocationPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Хуваарилалт
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хаанбанкны хуулгыг уншиж, гүйлгээний утгаар нь 1/10 ба өргөл гэж
          ялгана
        </p>
      </div>

      <StatementImport />
    </div>
  );
}
