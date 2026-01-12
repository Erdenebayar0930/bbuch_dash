import ProtectedRoute from "@/components/ProtectedRoute";
import { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

interface LayoutProps {
  children: ReactNode;
}

export default function DashboardPage({ children }: LayoutProps) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <div className="p-6 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
