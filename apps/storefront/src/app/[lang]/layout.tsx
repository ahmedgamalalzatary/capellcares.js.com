import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { languages, dir, getDict } from "@capella/shared";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { AskCapellaButton } from "@/components/ask-capella/ask-capella-button";
import { fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { buildHeaderMenu } from "@/lib/header-menu";
import { buildNav } from "@/lib/nav";
import { buildLocaleMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildLocaleMetadata(lang);
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const [categories, products, offers, collections] = await Promise.all([
    fetchCategories({ lang }).catch(() => []),
    fetchProducts({ lang }).catch(() => []),
    fetchOffers({ lang }).catch(() => []),
    fetchCollections({ lang }).catch(() => [])
  ]);
  const navGroups = buildNav(categories, lang);
  const menuEntries = buildHeaderMenu({ navGroups, products, offers, collections, dict, lang });

  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <div className="shell" lang={lang} dir={dir(lang)}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
            />
            <Suspense fallback={null}>
              <Header lang={lang} dict={dict} menuEntries={menuEntries} />
            </Suspense>
            <div>{children}</div>
            <AskCapellaButton lang={lang} />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
