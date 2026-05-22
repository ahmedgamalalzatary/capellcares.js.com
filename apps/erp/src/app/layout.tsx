import type { ReactNode } from "react";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";
import { ErpToaster } from "@/components/providers/erp-toaster";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Capella ERP",
  description: "Capella admin panel"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", geist.variable)}>
      <body>
        <AdminAuthProvider>
          <ErpToaster />
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
