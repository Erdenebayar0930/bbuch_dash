import SettingsView from "@/components/settings/SettingsView";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Тохиргоо
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          Бүртгэл, компани, аюулгүй байдлын тохиргоо
        </p>
      </div>

      <SettingsView />
    </div>
  );
}
