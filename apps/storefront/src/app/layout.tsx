import type { ReactNode } from "react";
import "./globals.css";
import { Roboto_Mono, Playwrite_GB_S_Guides } from "next/font/google";
import { cn } from "@/lib/utils";
import { buildRootMetadata } from "@/lib/seo";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const playwrite = Playwrite_GB_S_Guides({
  weight: "400",
  variable: "--font-signature",
});

export const metadata = buildRootMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={cn("font-sans", robotoMono.variable, playwrite.variable)}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
