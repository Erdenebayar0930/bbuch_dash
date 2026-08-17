"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getCurrentUser } from "@/lib/users";
import Input from "@/components/form/input/InputField";
import Checkbox from "@/components/form/input/Checkbox";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { enableLocalBiometric, isBiometricSupported } from "@/lib/biometric";

// ------------------- Fingerprint бүртгэл -------------------
export async function registerFingerprint(email: string) {
  if (!window.PublicKeyCredential) {
    alert("WebAuthn дэмжигдээгүй байна");
    return;
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)), 
    rp: { name: "My PWA" },
    user: {
      id: new Uint8Array(16), 
      name: email,
      displayName: email
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
    timeout: 60000,
    attestation: "direct"
  };

  try {
    const credential = await navigator.credentials.create({ publicKey });
    localStorage.setItem("fingerprintRegistered", "true"); // Дараа нь шалгах
    localStorage.setItem("fingerprintEmail", email);
    console.log("Fingerprint registered:", credential);
    alert("✅ Fingerprint амжилттай бүртгэгдлээ!");
  } catch (err) {
    console.error(err);
    alert("Fingerprint бүртгэл амжилтгүй боллоо: " + err);
  }
}

// ------------------- Fingerprint login -------------------

export default function SignInForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFingerprintLogin, setShowFingerprintLogin] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);

  // Fingerprint идэвхжүүлсэн эсэхийг шалгах
  useEffect(() => {
    const fingerprintRegistered = localStorage.getItem("fingerprintRegistered");
    const fingerprintEmail = localStorage.getItem("fingerprintEmail");
    const fingerprintPassword = localStorage.getItem("fingerprintPassword");
    
    if (fingerprintRegistered === "true" && fingerprintEmail && fingerprintPassword) {
      setShowFingerprintLogin(true);
      setEmail(fingerprintEmail);
    }
  }, []);

  // Fingerprint login хийх
  const handleFingerprintLogin = async () => {
    if (!window.PublicKeyCredential) {
      setError("WebAuthn дэмжигдээгүй байна");
      return;
    }

    const savedEmail = localStorage.getItem("fingerprintEmail");
    const savedPassword = localStorage.getItem("fingerprintPassword");
    
    if (!savedEmail || !savedPassword) {
      setError("Fingerprint мэдээлэл олдсонгүй");
      return;
    }

    setFingerprintLoading(true);
    setError("");

    try {
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [],
        timeout: 60000,
        userVerification: "required"
      };

      const credential = await navigator.credentials.get({ publicKey });
      console.log("Fingerprint login:", credential);

      // Fingerprint амжилттай бол Firebase-д нэвтрэх
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, savedEmail, savedPassword);

      if (!userCredential.user.emailVerified) {
        setError("Имэйл хаягаа баталгаажуулна уу. Баталгаажуулалтын холбоосыг явуулсан.");
        await auth.signOut();
        return;
      }

      router.push("/");
    } catch (err: any) {
      console.error(err);
      if (err.name === "NotAllowedError") {
        setError("Fingerprint нэвтрэх цуцлагдлаа");
      } else {
        setError("Fingerprint нэвтрэхэд алдаа гарлаа");
      }
    } finally {
      setFingerprintLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
         // 👉 Сануулах checkbox-оос хамаарч persistence сонгох
        await setPersistence(
        auth,
        rememberMe
            ? browserLocalPersistence   // ✔ Сануулах
            : browserSessionPersistence // ❌ Сануулахгүй → cache цэвэрлэгдэнэ
        );
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        setError("Имэйл хаягаа баталгаажуулна уу. Баталгаажуулалтын холбоосыг явуулсан.");
        await auth.signOut();
        return;
      }

      // Профайл Postgres-д хадгалагдана — ID token-оор дамжуулан уншина
      const profile = await getCurrentUser().catch(() => null);
      const status = profile?.status ?? "active";
      if (status === "blocked") {
        await auth.signOut();
        setError("Таны хандах эрх хаасан байна. Админтай холбоо барина уу.");
        return;
      }

      if (status === "pending") {
        await auth.signOut();
        setError("Таны бүртгэл хүлээгдэж байна. Админ зөвшөөрсний дараа нэвтэрнэ үү.");
        return;
      }

      //   if (isBiometricSupported()) {
      //   //await enableLocalBiometric(userCredential.user.uid);
      // }
       // Fingerprint register санал харуулах
        if (!localStorage.getItem("fingerprintRegistered")) {
          const enableFingerprint = confirm("FingerPrint-аар нэвтрэхийг идэвхжүүлэх үү?");
          if (enableFingerprint) {
            await registerFingerprint(email);
            // Password-ийг хадгалах (fingerprint login-д ашиглах)
            localStorage.setItem("fingerprintPassword", password);
          }
        }

        router.push("/");
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
              Бид туслая
            </h1>
          </div>

          {/* Fingerprint Login Section */}
          {showFingerprintLogin && (
            <div className="mb-6 p-4 border border-brand-200 rounded-lg bg-brand-50 dark:bg-brand-500/10 dark:border-brand-500/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    Fingerprint нэвтрэх
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {email} - Fingerprint-аар нэвтрэх
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFingerprintLogin(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L10 8.94033L12.7197 6.22065C13.0126 5.92775 13.4874 5.92775 13.7803 6.22065C14.0732 6.51354 14.0732 6.98841 13.7803 7.28131L11.0607 10L13.7803 12.7187C14.0732 13.0116 14.0732 13.4865 13.7803 13.7794C13.4874 14.0722 13.0126 14.0722 12.7197 13.7794L10 11.0607L7.28033 13.7794C6.98744 14.0722 6.51256 14.0722 6.21967 13.7794C5.92678 13.4865 5.92678 13.0116 6.21967 12.7187L8.93934 10L6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
              <Button
                onClick={handleFingerprintLogin}
                disabled={fingerprintLoading}
                className="w-full"
                size="sm"
              >
                {fingerprintLoading ? "Түр хүлээнэ үү..." : "Fingerprint-аар нэвтрэх"}
              </Button>
            </div>
          )}

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
                    {/* {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )} */}
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

              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Бүртгэлгүй юу?{" "}
                <Link
                  href="/register"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Бүртгүүлэх
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

