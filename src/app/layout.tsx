import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body  className="bg-gray-50 dark:bg-gray-900"> 
        {/* Client-side auth state */}
        <AuthProvider>
          {children} {/* server-side дээрээ loading placeholder */}
        </AuthProvider>
      </body>
    </html>
  );
}
