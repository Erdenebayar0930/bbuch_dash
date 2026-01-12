"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // loading дууссан үед л redirect хийх
    if (!loading) {
      if (user) {
        router.push("/dashboard"); // replace биш push ажиллана
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500">Checking authentication...</p>
    </div>
  );
}
