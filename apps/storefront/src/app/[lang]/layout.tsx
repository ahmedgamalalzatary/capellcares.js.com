import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { dir, getDict } from "@capella/shared";
import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistProvider } from "@/components/providers/wishlist-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ReviewPromptProvider } from "@/components/providers/review-prompt-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AskCapellaButton } from "@/components/ask-capella/ask-capella-button";
import { BackToTop } from "@/components/shop/back-to-top";
import { fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { buildHeaderMenu } from "@/lib/header-menu";
import { buildNav } from "@/lib/nav";
import { buildLocaleMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

// The root <html dir> is derived from the x-capella-locale request header set
// by middleware. Static prerendering has no request, so at build time that
// header is absent and dir wrongly defaults to "ar"/rtl on the EN page. Render
// the locale subtree per-request so middleware's header drives <html dir>
// (and every CSS rtl:/[dir=rtl] consumer) correctly.
export const dynamic = "force-dynamic";

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
      <ReviewPromptProvider lang={lang} dict={dict}>
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
            <div className="flex-1">{children}</div>
            <Footer lang={lang} dict={dict} />
            <BackToTop label={dict.common.backToTop} />
            <AskCapellaButton lang={lang} />
          </div>
          </CartProvider>
        </WishlistProvider>
      </ReviewPromptProvider>
    </AuthProvider>
  );
}
