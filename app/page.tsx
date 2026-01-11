"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import SignIn from "@/components/SignIn";

export default function Home() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {user && (
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Sign Out
          </button>
        )}
      </header>

      {user ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="font-bold text-lg">Users</h2>
            <p className="text-2xl">10</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h2 className="font-bold text-lg">Orders</h2>
            <p className="text-2xl">5</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h2 className="font-bold text-lg">Revenue</h2>
            <p className="text-2xl">$1000</p>
          </div>
        </div>
      ) : (
        <SignIn />
      )}
    </div>
  );
}
