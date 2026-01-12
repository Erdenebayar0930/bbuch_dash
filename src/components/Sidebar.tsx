// components/Sidebar.tsx
"use client"; // <--- Энэ мөр хамгийн эхэнд байх ёстой

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation"; // next/navigation ашиглана

export default function Sidebar() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login"); // logout хийсний дараа redirect
  };

  return (
    <div className="w-64 bg-blue-800 text-white flex flex-col">
      <div className="text-2xl font-bold p-6">Dashboard</div>
      <nav className="flex-1">
        <ul>
          <li className="p-4 hover:bg-blue-700 cursor-pointer">Home</li>
          <li className="p-4 hover:bg-blue-700 cursor-pointer">Profile</li>
          <li className="p-4 hover:bg-blue-700 cursor-pointer">Settings</li>
        </ul>
      </nav>
      <button
        onClick={handleLogout}
        className="m-4 p-2 bg-red-600 rounded hover:bg-red-500"
      >
        Logout
      </button>
    </div>
  );
}
