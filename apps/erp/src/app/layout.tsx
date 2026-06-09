import type { ReactNode } from "react";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";
import { ErpToaster } from "@/components/providers/erp-toaster";

export const metadata = {
  title: "Capella ERP",
  description: "Capella admin panel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="font-sans">
      <body>
        <AdminAuthProvider>
          <ErpToaster />
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
