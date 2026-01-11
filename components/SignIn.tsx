"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert("Нэвтрэхэд алдаа гарлаа. Та дахин оролдоно уу.");
      console.error(error);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-20">
      <h2 className="text-xl font-bold mb-4">ББУЧ-Dashboard</h2>
      <input
        type="email"
        placeholder="И-мэйл"
        className="w-full p-2 mb-4 border rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Нууц үг"
        className="w-full p-2 mb-4 border rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="w-full bg-blue-500 text-white py-2 rounded"
      >
        Нэвтрэх
      </button>
    </div>
  );
}
