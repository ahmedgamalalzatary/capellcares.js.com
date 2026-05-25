import type { ReactNode } from "react";
import "./globals.css";
import { Roboto_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { buildRootMetadata } from "@/lib/seo";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

export const metadata = buildRootMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={cn("font-sans", robotoMono.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playwrite+GB+S+Guides:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
