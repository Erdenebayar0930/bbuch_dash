"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useUser } from "./UserProvider";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState(!user); // already cached бол loading=false

  useEffect(() => {
    // ✅ already cached → шууд нэвтрүүлнэ
    if (user) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/login");
        return;
      }

      const snap = await getDoc(doc(db, "users", firebaseUser.uid));

      if (!snap.exists()) {
        router.replace("/unauthorized");
        return;
      }

      const data = snap.data();

      if (data.role !== "admin") {
        router.replace("/unauthorized");
        return;
      }

      const userData = {
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
        photoURL: data.photoURL ?? "",
      };

      setUser(userData); // ✅ sessionStorage + context-д хадгална
      setLoading(false);
    });

    return () => unsub();
  }, [user, router, setUser]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-primary dark:border-gray-700 dark:border-t-primary"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
