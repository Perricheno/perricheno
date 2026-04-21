import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { AdminProvider } from "@/components/AdminContext";
import { ToastProvider } from "@/components/ToastContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Perricheno — Academic AI Workspace",
  description: "Research, write, cite, and visualize. Generate LaTeX papers, search arXiv and OpenAlex, and produce publication-ready figures in one place.",
  manifest: "/manifest.json",
  icons: {
    icon: "/newlogo.png",
    apple: "/newlogo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Perricheno",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import MinimalSidebar from "@/components/MinimalSidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--background)] text-[var(--foreground)] h-screen overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
            <AdminProvider>
                <ToastProvider>
                    <div className="flex h-screen w-full">
                        <MinimalSidebar />
                        <main className="flex-1 flex flex-col p-2 pl-0 md:p-4 md:pl-0 h-full overflow-hidden">
                            <div className="flex-1 bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-sm overflow-y-auto">
                                {children}
                            </div>
                        </main>
                    </div>
                </ToastProvider>
            </AdminProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
