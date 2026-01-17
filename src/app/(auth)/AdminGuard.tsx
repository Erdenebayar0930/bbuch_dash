"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { useUser } from "@/app/(auth)/UserProvider";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setUser } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        router.replace("/unauthorized");
        return;
      }

      const userData = userSnap.data();

      if (userData.role !== "admin") {
        router.replace("/unauthorized");
        return;
      }

      // ✅ Context-д хадгална
      setUser({
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role,
        photoURL: userData.photoURL ?? "",
      });

      setLoading(false);
    });

    return () => unsub();
  }, [router, setUser]);

   if (loading) {
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar skeleton */}
      <div className="w-64 bg-white dark:bg-gray-800 p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
          />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-6">
        <div className="h-6 w-1/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-white dark:bg-gray-800 shadow animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}


  return <>{children}</>;
}
