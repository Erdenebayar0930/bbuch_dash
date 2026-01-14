"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const login = async () => {
    await signInWithEmailAndPassword(auth, email, password);
    router.replace("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-80 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
        <input className="input" placeholder="Email" onChange={e=>setEmail(e.target.value)} />
        <input className="input mt-2" type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} />
        <button className="btn-primary mt-4 w-full" onClick={login}>Login</button>
      </div>
    </div>
  );
}
