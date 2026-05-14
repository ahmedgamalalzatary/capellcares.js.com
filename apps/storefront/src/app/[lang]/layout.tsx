import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { languages, dir, getDict, type Language } from "@capella/shared";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export const metadata = {
  title: "Capella Cares — skin-deep care, head to toe",
  description: "Capella Cares: bilingual beauty and self-care storefront."
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <div className="shell" lang={lang} dir={dir(lang as Language)}>
            <Header lang={lang as Language} dict={dict} />
            <div>{children}</div>
            <Footer lang={lang as Language} dict={dict} />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
