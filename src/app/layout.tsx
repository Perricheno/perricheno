import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminProvider } from "@/components/AdminContext";
import { ToastProvider } from "@/components/ToastContext";
import MobileNav from "@/components/MobileNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Perricheno",
  description: "Personal site of Perricheno - Student, Analyst, DevOps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--background)] text-[var(--foreground)]`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
            <AdminProvider>
                <ToastProvider>
                    {children}
                    <MobileNav />
                </ToastProvider>
            </AdminProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
