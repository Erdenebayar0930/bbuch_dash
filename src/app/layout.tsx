import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "BBuch PWA",
  description: "Next.js + Tailwind + PWA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  <ThemeToggle />
  {children}
  <BottomNav />
</body>
    </html>
  );
}
