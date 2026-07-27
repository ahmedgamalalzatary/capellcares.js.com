import type { Metadata } from "next";
import Link from "next/link";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { Niche, type Alcove } from "@/components/shop/niche";
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

/**
 * One heading treatment for every row on the page: title on the start edge,
 * "view all" on the end edge, sharing a baseline.
 */
function RowHead({
  title,
  href,
  cta,
  isAr
}: {
  title: string;
  href: string;
  cta: string;
  isAr: boolean;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-6">
      <h2 className="section-title">{title}</h2>
      <Link
        href={href}
        className={`shrink-0 pb-1 text-sm font-bold text-deep underline-offset-4 hover:underline ${
          isAr ? "" : "uppercase tracking-[0.1em]"
        }`}
      >
        {cta}
      </Link>
    </header>
  );
}

export default async function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const isAr = lang === "ar";

  const { products, offers, collections, categories, advices, shopMediaSections } =
    await loadShopPageData(lang);

  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  const activeCollections = collections.filter(
    (c) => c.status === "active" && c.visibility === "visible" && !c.deletedAt
  );
  const activeProducts = products.filter((p) => p.status === "active" && !p.deletedAt);
  const newProducts = activeProducts.filter((p) => p.isNew);
  const bestsellerProducts = activeProducts.filter((p) => p.isBestseller);
  const categoryNameById = new Map(
    categories.map((c) => [c.id, pickLang(c.name, lang)] as const)
  );
  const shopMediaBySlot = new Map(
    shopMediaSections.map((section) => [section.slot, section] as const)
  );

  // One recess per top-level line, each showing a real product from inside it.
  // Roots with nothing photographed yet are skipped rather than shown empty —
  // an alcove with no object in it is just a hole.
  const rootCategories = categories.filter((category) => category.parentId === null);
  const alcoves: Alcove[] = rootCategories
    .map((root) => {
      const descendantIds = new Set<number>([
        root.id,
        ...categories.filter((c) => c.parentId === root.id).map((c) => c.id)
      ]);
      const feature = activeProducts.find(
        (product) => descendantIds.has(product.categoryId) && Boolean(product.imagePath)
      );
      if (!feature) return null;
      return {
        href: `/${lang}/category/${root.slug}`,
        label: pickLang(root.name, lang),
        image: feature.imagePath,
        alt: pickLang(feature.name, lang)
      } satisfies Alcove;
    })
    .filter((entry): entry is Alcove => entry !== null);

  return (
    <main className="container">
      {/* The niche: the café's lit wall, carrying the page's opening statement.
          Container-width and rounded, matching the footer's blush card so the
          page reads as one column of panels. */}
      <Niche className="mb-8" alcoves={alcoves}>
        <p className="eyebrow">{dict.shop.eyebrow}</p>
        {/* Arabic sets smaller: Cairo runs larger on the body at a given px
            than Bodoni caps do, and Arabic lines need more measure before
            they read as cramped. */}
        <h1
          className={
            isAr
              ? "section-title max-w-[16ch] text-[clamp(26px,3.4vw,42px)]"
              : "section-title max-w-[15ch] text-[clamp(30px,4.4vw,56px)]"
          }
        >
          {dict.shop.heading}
        </h1>
        <p className="max-w-[42ch] text-base leading-relaxed text-(--ink-2)">
          {dict.shop.description}
        </p>
        <div>
          <Link href={`/${lang}/products`} className="btn btn--primary">
            {dict.shop.viewAllProducts}
          </Link>
        </div>
      </Niche>

      <div>
        <ShopMediaStrip
          lang={lang}
          section={shopMediaBySlot.get(1) ?? { id: -1, slot: 1, status: "inactive", items: [] }}
          label={dict.shopMedia.sectionLabel}
          flatTop
        />

        {/* Offers */}
        {activeOffers.length > 0 && (
          <section className="mb-12">
            <RowHead
              title={dict.offers.title}
              href={`/${lang}/offers`}
              cta={dict.shop.viewAllOffers}
              isAr={isAr}
            />
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

        {/* Boxes */}
        {activeCollections.length > 0 && (
          <>
            <hr className="niche-rule" />
            <section className="mb-12">
              <RowHead
                title={dict.collections.title}
                href={`/${lang}/collections`}
                cta={dict.shop.viewAllCollections}
                isAr={isAr}
              />
              <ShopCardRow lang={lang}>
                {activeCollections.map((collection) => (
                  <SectionCard
                    key={collection.id}
                    kind="collection"
                    data={collection}
                    lang={lang}
                    dict={dict}
                  />
                ))}
              </ShopCardRow>
            </section>
          </>
        )}

        <ShopMediaStrip
          lang={lang}
          section={shopMediaBySlot.get(3) ?? { id: -3, slot: 3, status: "inactive", items: [] }}
          label={dict.shopMedia.sectionLabel}
        />

        {/* Bestsellers */}
        {bestsellerProducts.length > 0 && (
          <>
            <hr className="niche-rule" />
            <section className="mb-12">
              <RowHead
                title={dict.shop.bestsellers}
                href={`/${lang}/bestsellers`}
                cta={dict.shop.viewAllProducts}
                isAr={isAr}
              />
              <ShopCardRow lang={lang}>
                {bestsellerProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    dict={dict}
                    categoryName={categoryNameById.get(product.categoryId)}
                  />
                ))}
              </ShopCardRow>
            </section>
          </>
        )}

        <ShopMediaStrip
          lang={lang}
          section={shopMediaBySlot.get(4) ?? { id: -4, slot: 4, status: "inactive", items: [] }}
          label={dict.shopMedia.sectionLabel}
        />

        {/* Just in */}
        {newProducts.length > 0 && (
          <>
            <hr className="niche-rule" />
            <section className="mb-12">
              <RowHead
                title={dict.shop.newProducts}
                href={`/${lang}/new`}
                cta={dict.shop.viewAllProducts}
                isAr={isAr}
              />
              <ShopCardRow lang={lang}>
                {newProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    dict={dict}
                    categoryName={categoryNameById.get(product.categoryId)}
                  />
                ))}
              </ShopCardRow>
            </section>
          </>
        )}

        <ShopMediaStrip
          lang={lang}
          section={shopMediaBySlot.get(5) ?? { id: -5, slot: 5, status: "inactive", items: [] }}
          label={dict.shopMedia.sectionLabel}
        />

        {/* From the counter */}
        <AdviceSection advices={advices} lang={lang} dict={dict} scrollRow />
      </div>
    </main>
  );
}
