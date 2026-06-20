import type { Metadata } from "next";
import Link from "next/link";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { BackToTop } from "@/components/shop/back-to-top";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadShopPageData } from "@/lib/storefront-static-data";
import { buildShopMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildShopMetadata(lang);
}

export default async function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const isAr = lang === "ar";

  const { products, offers, collections, categories, advices, shopMediaSections } = await loadShopPageData(lang);

  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  const activeCollections = collections.filter(
    (c) => c.status === "active" && c.visibility === "visible" && !c.deletedAt
  );
  const activeProducts = products.filter((p) => p.status === "active" && !p.deletedAt);
  const newProducts = activeProducts.filter((p) => p.isNew);
  const bestsellerProducts = activeProducts.filter((p) => p.isBestseller);
  const categoryNameById = new Map(categories.map((c) => [c.id, pickLang(c.name, lang)] as const));
  const shopMediaBySlot = new Map(shopMediaSections.map((section) => [section.slot, section] as const));

  return (
    <main className="container">

      <ShopMediaStrip
        lang={lang}
        section={shopMediaBySlot.get(1) ?? { id: -1, slot: 1, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
        flatTop
      />

      {/* Offers */}
      {activeOffers.length > 0 && (
        <section className="mb-8">
          <header className="mb-8 flex items-end justify-between">
            <div className="grid gap-1.5">
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.offers.title}
              </h2>
            </div>
            <Link
              href={`/${lang}/offers`}
              className={`shrink-0 text-sm text-accent underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllOffers}
            </Link>
          </header>

          <ShopCardRow lang={lang}>
            {activeOffers.map((offer) => (
              <SectionCard key={offer.id} kind="offer" data={offer} lang={lang} dict={dict} />
            ))}
          </ShopCardRow>
        </section>
      )}

      <ShopMediaStrip
        lang={lang}
        section={shopMediaBySlot.get(2) ?? { id: -2, slot: 2, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
      />

      {/* Collections */}
      {activeCollections.length > 0 && (
        <section className="mb-8">
          <header className="mb-8 flex items-end justify-between">
            <div className="grid gap-1.5">
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.collections.title}
              </h2>
            </div>
            <Link
              href={`/${lang}/collections`}
              className={`shrink-0 text-sm text-accent underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllCollections}
            </Link>
          </header>

          <ShopCardRow lang={lang}>
            {activeCollections.map((collection) => (
              <SectionCard key={collection.id} kind="collection" data={collection} lang={lang} dict={dict} />
            ))}
          </ShopCardRow>
        </section>
      )}

      <ShopMediaStrip
        lang={lang}
        section={shopMediaBySlot.get(3) ?? { id: -3, slot: 3, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
      />

      {/* Bestsellers */}
      {bestsellerProducts.length > 0 && (
        <section className="mb-8">
          <header className="mb-8 flex items-end justify-between">
            <div className="grid gap-1.5">
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.shop.bestsellers}
              </h2>
            </div>
            <Link
              href={`/${lang}/bestsellers`}
              className={`shrink-0 text-sm text-(--ink-2) underline-offset-4 hover:underline hover:text-ink ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllProducts}
            </Link>
          </header>

          <ShopCardRow lang={lang}>
            {bestsellerProducts.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} categoryName={categoryNameById.get(product.categoryId)} />
            ))}
          </ShopCardRow>
        </section>
      )}

      <ShopMediaStrip
        lang={lang}
        section={shopMediaBySlot.get(4) ?? { id: -4, slot: 4, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
      />

      {/* New */}
      {newProducts.length > 0 && (
        <section className="mb-8">
          <header className="mb-8 flex items-end justify-between">
            <div className="grid gap-1.5">
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.shop.newProducts}
              </h2>
            </div>
            <Link
              href={`/${lang}/new`}
              className={`shrink-0 text-sm text-accent underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllProducts}
            </Link>
          </header>

          <ShopCardRow lang={lang}>
            {newProducts.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} categoryName={categoryNameById.get(product.categoryId)} />
            ))}
          </ShopCardRow>
        </section>
      )}

      <ShopMediaStrip
        lang={lang}
        section={shopMediaBySlot.get(5) ?? { id: -5, slot: 5, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
      />

      {/* Capella Advices */}
      <AdviceSection advices={advices} lang={lang} dict={dict} scrollRow />

      <BackToTop label={dict.common.backToTop} />
    </main>
  );
}
