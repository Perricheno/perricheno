import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AdminProvider } from "@/components/AdminContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Perricheno",
  description: "Personal site of Perricheno - Student, Analyst, DevOps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AdminProvider>
            {children}
          </AdminProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
