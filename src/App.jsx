
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const companies = [
  { id: "c1", name: "Company A", erpUrl: "https://company-a-erp.web.app" },
  { id: "c2", name: "Company B", erpUrl: "https://company-b-erp.web.app" }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow w-80">
          <h1 className="text-xl font-bold mb-4">Login</h1>
          <input className="border p-2 w-full mb-2" placeholder="Email" onChange={e=>setEmail(e.target.value)} />
          <input type="password" className="border p-2 w-full mb-4" placeholder="Password" onChange={e=>setPassword(e.target.value)} />
          <button className="bg-blue-600 text-white w-full py-2"
            onClick={()=>signInWithEmailAndPassword(auth, email, password)}>
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Company Select</h1>
        <button onClick={()=>signOut(auth)} className="text-red-500">Logout</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {companies.map(c => (
          <div key={c.id} className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold">{c.name}</h2>
            <button
              className="mt-2 bg-green-600 text-white px-4 py-2"
              onClick={()=>window.location.href = c.erpUrl}>
              Enter ERP
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
