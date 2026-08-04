"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { auth } from "@/lib/firebase";
import { registerUser } from "@/lib/users";

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: Form = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

/** Firebase-ийн алдааг монгол мессеж рүү хөрвүүлнэ */
function errorMessage(code?: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "Энэ имэйл хаягаар бүртгэл үүссэн байна.";
    case "auth/invalid-email":
      return "Имэйл хаяг буруу байна.";
    case "auth/weak-password":
      return "Нууц үг хэтэрхий сул байна. 6-аас дээш тэмдэгт оруулна уу.";
    case "auth/operation-not-allowed":
      return "Имэйл/нууц үгээр бүртгүүлэх боломж идэвхжээгүй байна.";
    case "auth/network-request-failed":
      return "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.";
    case "permission-denied":
      return "Бүртгүүлэхэд алдаа гарлаа. Дахин оролдоно уу.";
    default:
      return "Бүртгүүлэхэд алдаа гарлаа.";
  }
}

export default function SignUpForm() {
  const router = useRouter();

  const [form, setForm] = useState<Form>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const update = (key: keyof Form, value: string) => {
    setError("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password.length < 6) {
      setError("Нууц үг 6-аас дээш тэмдэгт байх ёстой.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Нууц үг хоорондоо таарахгүй байна.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });

      await signOut(auth);
      setPending(true);
      setVerificationSent(true);
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      setError(errorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <div className="flex w-full flex-1 items-center justify-center px-4 py-10 lg:w-1/2 lg:px-6">
        <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
          <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
            Бүртгэл үүслээ
          </h1>
          <div className="space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
            <p>Таны бүртгэл амжилттай үүслээ.</p>
            <ul className="list-disc pl-5 text-gray-600 dark:text-gray-400">
              <li>Имэйл хаягийг баталгаажуулна уу.</li>
              <li>Таны бүртгэл супер админ/админын баталгаажуулалтыг хүлээнэ.</li>
              <li>Баталгаажуулалтын дараа нэвтрэх боломжтой болно.</li>
            </ul>
          </div>

          <Link href="/login" className="mt-6 block">
            <Button className="w-full" size="sm">
              Нэвтрэх хуудас руу буцах
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 items-center justify-center px-4 py-10 lg:w-1/2 lg:px-6">
      <div className="w-full max-w-md rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-gray-900/70 sm:p-8">
        <div className="mb-6">
          <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90 sm:text-2xl">
            Бүртгүүлэх
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Мэдээллээ бөглөж BBUCH-DASHBOARD-д бүртгүүлнэ үү.
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
          <p className="font-semibold">Админ эрх олгох журмын талаар</p>
          <p className="mt-1">
            Шинээр бүртгэгдсэн хэрэглэгчийн бүртгэл супер админ/админын баталгаажуулалтыг хүлээнэ. Баталгаажуулалтын дараа таны нэвтрэх эрх идэвхжинэ.
          </p>
          <Link href="/admin-access" className="mt-2 inline-flex font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-200">
            Дэлгэрэнгүйг үзэх
          </Link>
        </div>

        <form onSubmit={handleRegister}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>
                  Нэр <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="Нэрээ оруулна уу"
                  name="firstName"
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>
                  Овог <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="Овгоо оруулна уу"
                  name="lastName"
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>
                И-мэйл хаяг <span className="text-error-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="Имэйл хаягаа оруулна уу"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>

            <div>
              <Label>Утасны дугаар</Label>
              <Input
                type="tel"
                placeholder="+976 ...."
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>

            <div>
              <Label>
                Нууц үг <span className="text-error-500">*</span>
              </Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Дор хаяж 6 тэмдэгт"
                name="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
              />
            </div>

            <div>
              <Label>
                Нууц үг давтах <span className="text-error-500">*</span>
              </Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Нууц үгээ дахин оруулна уу"
                name="confirmPassword"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                required
              />
            </div>

            <label className="flex items-center gap-3 text-theme-sm text-gray-700 dark:text-gray-400">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
              />
              Нууц үг харуулах
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" size="sm" disabled={loading}>
              {loading ? "Түр хүлээнэ үү..." : "Бүртгүүлэх"}
            </Button>

            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Бүртгэлтэй юу?{" "}
              <Link
                href="/login"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Нэвтрэх
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
