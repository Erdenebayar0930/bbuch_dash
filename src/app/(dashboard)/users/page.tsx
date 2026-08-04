import AdminGuard from "@/app/(auth)/AdminGuard";
import UserManagement from "@/components/admin/UserManagement";

export default function UsersPage() {
  return (
    <AdminGuard requireAdmin>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Хэрэглэгчид
          </h1>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Superadmin болон админ зөвшөөрч, шинэ хэрэглэгчийн бүртгэл баталгаажсанаар идэвхждэг. Хэрэглэгчийг хүлээгдэж буй, идэвхтэй эсвэл хаасан статуст шилжүүлж болно.
          </p>
        </div>

        <UserManagement />
      </div>
    </AdminGuard>
  );
}
