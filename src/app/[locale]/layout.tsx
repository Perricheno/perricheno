import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { AdminProvider } from "@/components/AdminContext";
import { ToastProvider } from "@/components/ToastContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import MinimalSidebar from "@/components/MinimalSidebar";
import { initializeServer } from "@/lib/server-init";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Perricheno - Academic AI Workspace",
  description:
    "Research, write, cite, and visualize. Generate LaTeX papers, search arXiv and OpenAlex, and produce publication-ready figures in one place.",
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

if (typeof window === "undefined") {
  initializeServer();
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Only load messages for the current locale - never all languages at once
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.className} bg-[var(--background)] text-[var(--foreground)] h-screen overflow-hidden`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
