import type { Metadata } from "next";
import { Figtree, Young_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/hooks/useI18n";
import { getLang } from "@/lib/i18n/server";
import SiteHeader from "@/components/SiteHeader";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" });
const youngSerif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-young-serif" });

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Soliric",
  description: "Register the authorship of your lyrics on Solana. Anyone can verify it.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang} data-theme="dark" className={`${figtree.variable} ${youngSerif.variable} ${mono.variable}`}>
      <body className={figtree.className}>
        <I18nProvider initialLang={lang}>
          <AuthProvider>
            <SiteHeader />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
