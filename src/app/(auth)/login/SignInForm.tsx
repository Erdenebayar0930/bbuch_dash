"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

import Input from "@/components/form/input/InputField";
import Checkbox from "@/components/form/input/Checkbox";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "@/icons";

export default function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      switch (err.code) {
        case "auth/invalid-email":
          setError("Имэйл хаяг буруу байна.");
          break;
        case "auth/user-not-found":
          setError("Хэрэглэгч олдсонгүй.");
          break;
        case "auth/wrong-password":
          setError("Нууц үг буруу байна.");
          break;
        case "auth/invalid-credential":
          setError("Нэвтрэх мэдээлэл буруу байна.");
          break;
        case "auth/user-disabled":
          setError("Энэ хэрэглэгчийг хаасан байна.");
          break;
        default:
          setError("Нэвтрэхэд алдаа гарлаа.");
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
              BBUCH-DASHBOARD
            </h1>
          </div>

          <form onSubmit={handleLogin}>
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

              <div>
                <Label>
                  Нууц үг <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Нууц үгээ оруулна уу"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={rememberMe} onChange={setRememberMe} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Сануулах
                  </span>
                </div>
                <Link
                  href="/reset-password"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Нууц үгээ мартсан?
                </Link>
              </div>

              <div>
                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Түр хүлээнэ үү..." : "Нэвтрэх"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
