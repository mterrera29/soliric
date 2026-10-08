import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { I18nProvider } from "@/hooks/useI18n";
import { getLang } from "@/lib/i18n/server";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans" });
const fraunces = Fraunces({ subsets: ["latin"], weight: "variable", variable: "--font-fraunces", axes: ["SOFT", "WONK"] });

export const metadata: Metadata = {
  title: "Soliric",
  description: "Register the authorship of your lyrics on Solana. Anyone can verify it.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang} data-theme="dark" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className={dmSans.className}>
        <I18nProvider initialLang={lang}>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
