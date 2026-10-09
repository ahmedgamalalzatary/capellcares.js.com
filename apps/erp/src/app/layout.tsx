import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Roboto, Tajawal } from "next/font/google";
import "./globals.css";
import { AdminAuthProvider } from "@/components/providers/admin-auth";
import { ErpToaster } from "@/components/providers/erp-toaster";
import { themeBootScript } from "@/lib/theme-script";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

// Latin tabular figures for prices, quantities and SKUs.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Capella ERP", template: "%s · Capella ERP" },
  description: "Capella admin panel",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0ed" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} ${roboto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
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
