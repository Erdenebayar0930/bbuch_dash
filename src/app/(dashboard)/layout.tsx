"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AppHeader from "@/layout/AppHeader";
import SidebarWidget from "@/layout/SidebarWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = await getUserRole(user.uid);

      if (!role) {
        router.replace("/login");
        return;
      }

      // admin only example
      if (role !== "admin") {
        router.replace("/unauthorized");
        return;
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="flex">
      <main className="flex-1">
        <AppHeader />
        {children}
      </main>
    </div>
  );
}
