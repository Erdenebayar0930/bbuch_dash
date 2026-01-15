"use client";

import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Нууц үг сэргээх холбоос таны имэйлд илгээгдлээ.");
    } catch (err: any) {
      console.error(err);
      switch (err.code) {
        case "auth/invalid-email":
          setError("Имэйл хаяг буруу байна.");
          break;
        case "auth/user-not-found":
          setError("Хэрэглэгч олдсонгүй.");
          break;
        default:
          setError("Нууц үг сэргээхэд алдаа гарлаа.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Нууц үг сэргээх
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Имэйл хаягаа оруулж, нууц үг сэргээх холбоос илгээнэ үү.
            </p>
          </div>

          <form onSubmit={handleReset}>
            <div className="space-y-6">
              <div>
                <Label>
                  И-мэйл хаяг <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="Имэйл хаягаа оруулна уу"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              {success && <p className="text-green-500 text-sm">{success}</p>}

              <div>
                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Түр хүлээнэ үү..." : "Сэргээх холбоос илгээх"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-4 text-center">
            <Button
              onClick={() => router.push("/")}
              size="sm"
            >
              Буцах
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
