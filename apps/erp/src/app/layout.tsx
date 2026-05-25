import type { ReactNode } from "react";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";
import { ErpToaster } from "@/components/providers/erp-toaster";
import { Roboto_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "Capella ERP",
  description: "Capella admin panel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", robotoMono.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playwrite+GB+S+Guides:ital@0;1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AdminAuthProvider>
          <ErpToaster />
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
