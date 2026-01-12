"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

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
export async function loginWithFingerprint() {
  if (!window.PublicKeyCredential || !localStorage.getItem("fingerprintRegistered")) return;

  const email = localStorage.getItem("fingerprintEmail")!;
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [], // server эсвэл Firestore-с хадгалсан credential id-г оруулах боломжтой
    timeout: 60000,
    userVerification: "required"
  };

  try {
  const router = useRouter();
    const credential = await navigator.credentials.get({ publicKey });
    console.log("Fingerprint login:", credential);
    alert(`✅ ${email} Fingerprint-аар нэвтэрлээ`);
    // Дараа нь Firebase custom token ашиглан login хийж болно
  } catch (err) {
    console.error(err);
    alert("Fingerprint login амжилтгүй боллоо");
  }
}

// ------------------- Login Page -------------------
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // localStorage-с нэр сануулах email
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // Fingerprint-ээр автоматаар нэвтрэх
    if (localStorage.getItem("fingerprintRegistered")) {
      loginWithFingerprint();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("✅ Амжилттай нэвтэрлээ");

      // Сануулах email хадгалах эсвэл устгах
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // Fingerprint register санал харуулах
      if (!localStorage.getItem("fingerprintRegistered")) {
        const enableFingerprint = confirm("FingerPrint-аар нэвтрэхийг идэвхжүүлэх үү?");
        if (enableFingerprint) {
          await registerFingerprint(email);
        }
      }

    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setMessage("Email оруулна уу");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("📧 Нууц үг сэргээх email илгээгдлээ");
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto px-4 flex items-center justify-center bg-gradient-to-br from-indigo-300 via-indigo-400 to-indigo-600">
      <div className="relative w-full max-w-sm rounded-2xl bg-indigo-900/90 p-5 sm:p-8 shadow-2xl">

        {/* 👤 USER ICON */}
        <div className="absolute -top-10 sm:-top-12 left-1/2 -translate-x-1/2">
          <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-white shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-12 w-12 text-indigo-900"
            >
              <path
                fillRule="evenodd"
                d="M12 2.25a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM4.5 19.5a7.5 7.5 0 0115 0v.75a.75.75 0 01-.75.75h-13.5a.75.75 0 01-.75-.75v-.75z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin} className="mt-12 sm:mt-16 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md bg-gray-100 p-3 text-gray-800 outline-none"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md bg-gray-100 p-3 text-gray-800 outline-none"
            required
          />

          {/* Сануулах + Нууц үг сэргээх нэг мөр */}
          <div className="flex items-center justify-between text-sm text-gray-200">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              <span>Сануулах</span>
            </label>

            <button
              type="button"
              onClick={handleReset}
              className="hover:underline">
              Нууц үг сэргээх
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-950 py-3 font-semibold text-white hover:bg-black transition disabled:opacity-50"
          >
            {loading ? "Түр хүлээнэ үү..." : "Нэвтрэх"}
          </button>

          {message && (
            <p className="text-center text-sm text-white/90">{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
