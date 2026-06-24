import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { ProductRail } from "@/components/home/product-rail";
import { PromoBanner } from "@/components/home/promo-banner";
import { fetchCategories, fetchProducts } from "@/lib/api/client";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildLocaleMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await resolveStorefrontPageContext(params);
  return buildLocaleMetadata(lang);
}

export default async function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  const [categories, products] = await Promise.all([
    fetchCategories({ lang }).catch(() => []),
    fetchProducts({ lang }).catch(() => [])
  ]);

  const fmt = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0
  });

  const newArrivals = products.filter((p) => p.isNew).slice(0, 8);
  const bestsellers = products.filter((p) => p.isBestseller).slice(0, 8);
  // "Some Inspiration" — a curated mix that always has something to show.
  const inspiration = products
    .filter((p) => p.isNew || p.isBestseller)
    .slice(0, 4);
  const inspirationRail = inspiration.length ? inspiration : products.slice(0, 4);
  const allProductsHref = `/${lang}/products`;

  return (
    <main>
      <Hero lang={lang} dict={dict} />

      <CategoryShowcase categories={categories} lang={lang} dict={dict} />

      <ProductRail
        top={dict.shop.newArrivalsTop}
        bottom={dict.shop.newArrivalsBottom}
        products={newArrivals.length ? newArrivals : products.slice(0, 8)}
        lang={lang}
        dict={dict}
        fmt={fmt}
        href={allProductsHref}
        cta={dict.shop.viewAllProducts}
      />

      <ProductRail
        top={dict.shop.inspirationTop}
        bottom={dict.shop.inspirationBottom}
        description={dict.shop.inspirationDesc}
        products={inspirationRail}
        lang={lang}
        dict={dict}
        fmt={fmt}
      />

      <PromoBanner lang={lang} dict={dict} />

      <ProductRail
        top={dict.shop.bestSellersTop}
        bottom={dict.shop.bestSellersBottom}
        products={bestsellers.length ? bestsellers : products.slice(8, 16)}
        lang={lang}
        dict={dict}
        fmt={fmt}
        href={allProductsHref}
        cta={dict.shop.viewAllProducts}
        marginTop={72}
      />
    </main>
  );
}
