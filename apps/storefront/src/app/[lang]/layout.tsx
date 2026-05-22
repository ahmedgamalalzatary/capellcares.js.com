import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { languages, dir, getDict, type Language } from "@capella/shared";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { fetchCategories } from "@/lib/api/client";
import { buildNav } from "@/lib/nav";
import { buildLocaleMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  return buildLocaleMetadata(lang as Language);
}

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
  const categories = await fetchCategories({ lang }).catch(() => []);
  const navGroups = buildNav(categories, lang as Language);

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <div className="shell" lang={lang} dir={dir(lang as Language)}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
            />
            <Header lang={lang as Language} dict={dict} navGroups={navGroups} />
            <div>{children}</div>
            <Footer lang={lang as Language} dict={dict} />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
