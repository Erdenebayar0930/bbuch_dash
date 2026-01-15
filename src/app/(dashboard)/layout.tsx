"use client";

import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getUserRole } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/layout/AppHeader";
import { useUser } from "@/app/(auth)/UserContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }


      // 🔹 Firestore-аас user info авах
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

      // 🔹 Context-д user info хадгалах
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
