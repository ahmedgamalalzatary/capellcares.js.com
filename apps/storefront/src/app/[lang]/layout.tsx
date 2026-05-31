import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { languages, dir, getDict } from "@capella/shared";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AskCapellaButton } from "@/components/ask-capella/ask-capella-button";
import { fetchCategories } from "@/lib/api/client";
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
  const categories = await fetchCategories({ lang }).catch(() => []);
  const navGroups = buildNav(categories, lang);

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
              <Header lang={lang} dict={dict} navGroups={navGroups} />
            </Suspense>
            <div>{children}</div>
            <Footer lang={lang} dict={dict} />
            <AskCapellaButton lang={lang} />
          </div>
        </CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
