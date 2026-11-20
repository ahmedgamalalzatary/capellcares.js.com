import type { Metadata } from "next";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { SectionCard } from "@/components/shop/section-card";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { ShopRowSection } from "@/components/shop/shop-row-section";
import { BrandTiles, CategoryTiles, GenderTiles, ShopSectionHeading } from "@/components/shop/shop-tiles";
import { pickCategoryRowProducts } from "@/lib/shop-custom-sections";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadShopPageData } from "@/lib/storefront-static-data";
import { buildShopMetadata } from "@/lib/seo";

/** Custom section titles take these colours in turn, so neighbouring sections never match. */
const CUSTOM_SECTION_COLORS = ["violet", "blue", "cyan", "sunny", "magenta"] as const;

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

  const { categories, brands, genders, advices, shopMediaSections, products, offers, customBlocks } = await loadShopPageData(lang);

  // Nothing here should lead to an empty page, so items without products stay out.
  const mainCategories = categories.filter((c) => c.parentId == null && !c.deletedAt && c.hasProducts !== false);
  const shopBrands = brands.filter((brand) => brand.hasProducts !== false);
  const topBanner = shopMediaSections.find((section) => section.slot === 1);

  const liveProducts = products.filter((p) => p.status === "active" && !p.deletedAt);
  const bestsellerProducts = liveProducts.filter((p) => p.isBestseller);
  const newProducts = liveProducts.filter((p) => p.isNew);
  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  // A card must never name a category the shop has deleted.
  const liveCategories = categories.filter((c) => !c.deletedAt);
  const categoryById = new Map(liveCategories.map((c) => [c.id, c] as const));
  const categoryName = (id: number | null | undefined) => {
    const category = id == null ? undefined : categoryById.get(id);
    return category ? pickLang(category.name, lang) : undefined;
  };
  const productCard = (product: (typeof products)[number]) => (
    <ProductCard key={product.id} product={product} lang={lang} dict={dict} categoryName={categoryName(product.categoryId)} />
  );
  const viewAll = (path: string) => ({ href: `/${lang}${path}`, label: dict.shop.viewAll });

  let customColorIndex = 0;

  return (
    // The last section drops its bottom margin so the footer's own gap is the only space above it.
    <main className="container pt-6 [&>:last-child]:mb-0">
      <ShopMediaStrip
        lang={lang}
        section={topBanner ?? { id: -1, slot: 1, status: "inactive", items: [] }}
        label={dict.shopMedia.sectionLabel}
        priority
      />

      {genders.length > 0 && (
        <GenderTiles genders={genders} lang={lang} label={dict.shop.byGender} />
      )}

      {mainCategories.length > 0 && (
        <section id="categories" className="scroll-mt-28">
          <ShopSectionHeading color="magenta" viewAll={{ href: `/${lang}/categories`, label: dict.shop.viewAll }}>
            {dict.shop.byCategory}
          </ShopSectionHeading>
          <CategoryTiles categories={mainCategories} lang={lang} />
        </section>
      )}

      {bestsellerProducts.length > 0 && (
        <ShopRowSection title={dict.shop.bestsellers} color="sunny" viewAll={viewAll("/bestsellers")} lang={lang}>
          {bestsellerProducts.map(productCard)}
        </ShopRowSection>
      )}

      {/* Custom sections, in the order set in the ERP: a category's newest products, or a picture section. */}
      {customBlocks.map((block) => {
        if (block.type === "media") {
          return (
            <ShopMediaStrip key={`media-${block.id}`} lang={lang} section={block.mediaSection} label={dict.shopMedia.sectionLabel} />
          );
        }
        const category = categoryById.get(block.categoryId);
        const rowProducts = category ? pickCategoryRowProducts(category.id, liveCategories, liveProducts) : [];
        if (!category || rowProducts.length === 0) {
          return null;
        }
        const color = CUSTOM_SECTION_COLORS[customColorIndex++ % CUSTOM_SECTION_COLORS.length];
        return (
          <ShopRowSection
            key={`category-${block.id}`}
            title={pickLang(category.name, lang)}
            color={color}
            viewAll={viewAll(`/category/${category.slug}?categoryId=${category.id}`)}
            lang={lang}
          >
            {rowProducts.map(productCard)}
          </ShopRowSection>
        );
      })}

      {newProducts.length > 0 && (
        <ShopRowSection title={dict.shop.newProducts} color="cyan" viewAll={viewAll("/new")} lang={lang}>
          {newProducts.map(productCard)}
        </ShopRowSection>
      )}

      {activeOffers.length > 0 && (
        <ShopRowSection title={dict.offers.title} color="magenta" viewAll={viewAll("/offers")} lang={lang}>
          {activeOffers.map((offer) => (
            <SectionCard key={offer.id} kind="offer" data={offer} lang={lang} dict={dict} categoryName={categoryName(offer.categoryId)} />
          ))}
        </ShopRowSection>
      )}

      {shopBrands.length > 0 && (
        <section id="brands" className="mb-8 scroll-mt-28">
          <ShopSectionHeading color="blue" viewAll={{ href: `/${lang}/brands`, label: dict.shop.viewAll }}>
            {dict.shop.byBrand}
          </ShopSectionHeading>
          <BrandTiles brands={shopBrands} lang={lang} />
        </section>
      )}

      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
