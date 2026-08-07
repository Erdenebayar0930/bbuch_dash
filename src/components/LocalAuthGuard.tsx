"use client";

import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isLocalLoggedIn } from "@/lib/biometric";

// localStorage бол React-ийн гаднах store — effect дотор setState дуудахын оронд
// useSyncExternalStore-оор уншина. Server дээр `null` = "хараахан мэдэгдэхгүй".
function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export default function LocalAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const loggedIn = useSyncExternalStore(
    subscribe,
    () => isLocalLoggedIn(),
    () => null
  );

  useEffect(() => {
    if (loggedIn === false) {
      router.replace("/login");
    }
  }, [loggedIn, router]);

  if (loggedIn !== true) return <div className="p-6">Loading...</div>;
  return <>{children}</>;
}
