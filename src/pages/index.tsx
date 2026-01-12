import { useEffect, useState } from "react";
import Layout1 from "@/components/Layout";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState("Нэвтрэх"); // Нэвтрэх | Бүртгүүлэх | Нууц үг сэргээх
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleAction = async () => {
    setError("");
    setMsg("");

    if (!isValidEmail(email)) {
      setError("Имэйл хаяг буруу байна");
      return;
    }

    if ((mode === "Нэвтрэх" || mode === "Бүртгүүлэх") && password.length < 6) {
      setError("Нууц үг дор хаяж 6 тэмдэгт байх ёстой");
      return;
    }

    setLoading(true);

    try {
      if (mode === "Нэвтрэх") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === "Бүртгүүлэх") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        await sendEmailVerification(cred.user);
        setMsg("Баталгаажуулах имэйл илгээгдлээ");
      } else if (mode === "Нууц үг сэргээх") {
        await sendPasswordResetEmail(auth, email.trim());
        setMsg("Нууц үг шинэчлэх имэйл илгээгдлээ");
      }
    } catch (err: any) {
      setError(err.message || "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 DASHBOARD
  if (user && user.emailVerified) {
    return <Layout1 children={undefined} />;
  }

  // 🔹 EMAIL VERIFY
  if (user && !user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow w-80 text-center">
          <p className="mb-4">📧 Имэйл баталгаажуулаагүй байна</p>
          <button
            className="bg-blue-600 text-white w-full py-2"
            onClick={async () => {
              if (user) {
                await sendEmailVerification(user);
                setMsg("Баталгаажуулах имэйл илгээгдлээ");
              }
            }}
          >
            Verify Email
          </button>
          {msg && <p className="text-green-600 mt-3">{msg}</p>}
        </div>
      </div>
    );
  }

  // 🔹 AUTH UI
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow w-80">
        <h1 className="text-xl font-bold mb-4 capitalize">{mode}</h1>

        <input
          className="border p-2 w-full mb-2"
          placeholder="Имэйл хаяг"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {mode !== "Нууц үг сэргээх" && (
          <input
            type="password"
            className="border p-2 w-full mb-2"
            placeholder="Нууц үг"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        <button
          className={`w-full py-2 text-white ${
            mode === "Нэвтрэх"
              ? "bg-blue-600"
              : mode === "Бүртгүүлэх"
              ? "bg-green-600"
              : "bg-orange-600"
          }`}
          onClick={handleAction}
          disabled={loading}
        >
          {loading ? "Түр хүлээнэ үү..." : mode}
        </button>

        {error && <p className="text-red-600 mt-2">{error}</p>}
        {msg && <p className="text-green-600 mt-2">{msg}</p>}

        <div className="text-sm text-center mt-4 space-y-1">
          {["Нэвтрэх", "Бүртгүүлэх", "Нууц үг сэргээх"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="block w-full"
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
