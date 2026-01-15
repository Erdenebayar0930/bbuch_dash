import { Outfit } from "next/font/google";
import "./globals.css";
import "flatpickr/dist/flatpickr.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "./(auth)/UserContext";

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
      <body
        suppressHydrationWarning
        className={`${outfit.className} bg-white dark:bg-gray-900`}
      >
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
