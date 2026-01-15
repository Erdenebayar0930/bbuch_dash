"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/layout/AppHeader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const role = await getUserRole(user.uid);

      if (role !== "admin") {
        router.replace("/unauthorized");
      }
    });

    return () => unsub();
  }, []);

  // 🚀 UI-гаа шууд render хийж байна
  return (
    <div className="flex">
      <main className="flex-1">
        <AppHeader />
        {children}
      </main>
    </div>
  );
}
