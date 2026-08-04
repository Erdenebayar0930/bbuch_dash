"use client";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserRole } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  allow?: Array<"super" | "admin" | "user">;
};

export default function Protected({ children, allow }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // 🔒 Login page-г хамгаалахгүй
      if (pathname.startsWith("/login")) {
        setLoading(false);
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      // 🔑 Role шалгах
      if (allow && allow.length > 0) {
        const role = await getUserRole();

        if (!role || !allow.includes(role as (typeof allow)[number])) {
          router.replace("/unauthorized");
          return;
        }
      }

      setLoading(false);
    });

    return () => unsub();
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-gray-500">
        Checking authentication…
      </div>
    );
  }

  return <>{children}</>;
}
