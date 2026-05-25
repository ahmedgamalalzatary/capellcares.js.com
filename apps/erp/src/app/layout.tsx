import type { ReactNode } from "react";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";
import { ErpToaster } from "@/components/providers/erp-toaster";
import { Roboto_Mono, Playwrite_GB_S_Guides } from "next/font/google";
import { cn } from "@/lib/utils";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["100", "200", "300", "400", "500", "600", "700"],
});

const playwrite = Playwrite_GB_S_Guides({
  weight: "400",
  variable: "--font-signature",
});

export const metadata = {
  title: "Capella ERP",
  description: "Capella admin panel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", robotoMono.variable, playwrite.variable)}>
      <body>
        <AdminAuthProvider>
          <ErpToaster />
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
