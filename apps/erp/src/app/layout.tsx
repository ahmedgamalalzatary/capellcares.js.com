import type { ReactNode } from "react";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";

export const metadata = {
  title: "Capella ERP",
  description: "Capella admin panel"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
