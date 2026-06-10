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
    <html lang={lang} dir={dir(lang)} suppressHydrationWarning className={cn("font-sans")}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Tajawal:wght@300;400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
