import QuickLinks from "@/components/dashboard/QuickLinks";

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Үндсэн цэс
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Хэсгүүд рүү шилжих
        </p>
      </div>

      <QuickLinks />
    </div>
  );
}
