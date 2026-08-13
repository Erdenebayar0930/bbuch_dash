import { Outfit } from "next/font/google";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/app/(auth)/UserProvider";
import NotificationSetup from "@/components/NotificationSetup";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap", // ⚡ render blocking болиулна
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        {/* iOS нь ил тод дэвсгэрийг хараар дүүргэдэг тул тусдаа, дүүрэн icon. */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="ББУЧ" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/*
          Горимыг зурагдахаас ӨМНӨ тавина — эс бөгөөс харанхуй горимтой
          хэрэглэгчид эхний агшинд цагаан дэлгэц анивчина.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem("theme");var d=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className={`${outfit.className} bg-gray-50 dark:bg-gray-950`}>
        <ServiceWorkerRegister />
        <NotificationSetup />
        <UserProvider>
          <ThemeProvider>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}
