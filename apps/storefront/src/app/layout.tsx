import type { ReactNode } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { dir } from "@capella/shared";
import { cn } from "@/lib/utils";
import { buildRootMetadata } from "@/lib/seo";

export const metadata = buildRootMetadata();

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await headers()).get("x-capella-locale");
  const lang = locale === "en" ? "en" : "ar";
  return (
    <html lang={lang} dir={dir(lang)} data-scroll-behavior="smooth" suppressHydrationWarning className={cn("font-sans")}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Bodoni Moda — the Didone that matches the printed ĐESPACITO
            wordmark. Karla — body/UI. Cairo — Arabic. Three families,
            no more; the "Delight" script in the logo is set as italic
            Bodoni rather than dragging in a fourth face. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Karla:ital,wght@0,300..800;1,300..700&family=Cairo:wght@300..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
