import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export default function Login() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Нэвтэрсэн эсэхийг шалгах
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        router.push("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleLogin = async () => {
    setError("");

    if (!isValidEmail(email)) {
      setError("Имэйл хаяг буруу байна");
      return;
    }

    if (password.length < 6) {
      setError("Нууц үг дор хаяж 6 тэмдэгт байх ёстой");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      // амжилттай бол onAuthStateChanged автоматаар redirect хийнэ
    } catch (err) {
      setError("Имэйл эсвэл нууц үг буруу");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 LOGIN FORM
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow w-80">
        <h1 className="text-xl font-bold mb-4">Нэвтрэх</h1>

        <input
          className="border p-2 w-full mb-2"
          placeholder="Имэйл хаяг"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="border p-2 w-full mb-4"
          placeholder="Нууц үг"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="w-full bg-blue-600 text-white py-2"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Түр хүлээнэ үү..." : "Нэвтрэх"}
        </button>

        {error && (
          <p className="text-red-600 mt-2 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
