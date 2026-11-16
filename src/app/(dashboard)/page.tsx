import PostFeed from "@/components/posts/PostFeed";
import WeeklySchedule from "@/components/dashboard/WeeklySchedule";
import InstallPrompt from "@/components/pwa/InstallPrompt";

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Нүүр
        </h1>
      </div>

      <InstallPrompt />
      <WeeklySchedule />
      <PostFeed />
    </div>
  );
}
