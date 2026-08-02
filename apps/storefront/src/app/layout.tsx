import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { dir, defaultLanguage, languages, type Language } from "@minikoshk/shared";
import { chakraPetch, poppins } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Minikoshk Storefront",
  description: "Minikoshk storefront app"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The active locale is provided by middleware (it can't be read here as a
  // route param, since the root layout sits above the [lang] segment).
  const headerLocale = (await headers()).get("x-locale");
  const lang = ((languages as readonly string[]).includes(headerLocale ?? "")
    ? headerLocale
    : defaultLanguage) as Language;

  // `lang`/`dir` here give a correct first paint on hard loads/refreshes. During
  // client navigation the root layout isn't re-rendered, so the [lang] layout's
  // LocaleProvider keeps <html> in sync (see LocaleProvider).
  return (
    <html lang={lang} dir={dir(lang)} className={`${chakraPetch.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
