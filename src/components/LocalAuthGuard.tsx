"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLocalLoggedIn } from "@/lib/biometric";

export default function LocalAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLocalLoggedIn()) {
      router.replace("/login");
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) return <div className="p-6">Loading...</div>;
  return <>{children}</>;
}
