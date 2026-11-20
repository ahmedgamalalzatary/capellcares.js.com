import type { Metadata } from "next";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { SectionCard } from "@/components/shop/section-card";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { ShopRowSection } from "@/components/shop/shop-row-section";
import { BrandTiles, CategoryTiles, GenderTiles, ShopSectionHeading } from "@/components/shop/shop-tiles";
import { pickCategoryRowProducts } from "@/lib/shop-category-section";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadShopPageData } from "@/lib/storefront-static-data";
import { buildShopMetadata } from "@/lib/seo";

/** Category section titles take these colours in turn, so neighbouring sections never match. */
const CATEGORY_SECTION_COLORS = ["violet", "blue", "cyan", "sunny", "magenta"] as const;

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

  const { categories, brands, genders, advices, products, offers, collections, layout } = await loadShopPageData(lang);

  // Nothing here should lead to an empty page, so items without products stay out.
  const mainCategories = categories.filter((c) => c.parentId == null && !c.deletedAt && c.hasProducts !== false);
  const shopBrands = brands.filter((brand) => brand.hasProducts !== false);

  const liveProducts = products.filter((p) => p.status === "active" && !p.deletedAt);
  const bestsellerProducts = liveProducts.filter((p) => p.isBestseller);
  const newProducts = liveProducts.filter((p) => p.isNew);
  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  // The same sets the collections page lists.
  const activeCollections = collections.filter((c) => c.status === "active" && c.visibility === "visible" && !c.deletedAt);
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
  // The first picture section on the page loads its image first, as the top banner always has.
  const firstPictureBlockId = layout.find((block) => block.type === "media")?.id;

  let categoryColorIndex = 0;

  return (
    // The last section drops its bottom margin so the footer's own gap is the only space above it.
    <main className="container pt-6 [&>:last-child]:mb-0">
      {/* The sections in the order set in the ERP (Shop media → Page layout); Falta & Zoobi always closes the page. */}
      {layout.map((block) => {
        const key = `shop-section-${block.id}`;
        switch (block.type) {
          case "media":
            return (
              <ShopMediaStrip
                key={key}
                lang={lang}
                section={block.mediaSection}
                label={dict.shopMedia.sectionLabel}
                priority={block.id === firstPictureBlockId}
              />
            );
          case "genders":
            return genders.length > 0 ? <GenderTiles key={key} genders={genders} lang={lang} label={dict.shop.byGender} /> : null;
          case "category_tiles":
            return mainCategories.length > 0 ? (
              <section key={key} id="categories" className="scroll-mt-28">
                <ShopSectionHeading color="magenta" viewAll={{ href: `/${lang}/categories`, label: dict.shop.viewAll }}>
                  {dict.shop.byCategory}
                </ShopSectionHeading>
                <CategoryTiles categories={mainCategories} lang={lang} />
              </section>
            ) : null;
          case "bestsellers":
            return bestsellerProducts.length > 0 ? (
              <ShopRowSection key={key} title={dict.shop.bestsellers} color="sunny" viewAll={viewAll("/bestsellers")} lang={lang}>
                {bestsellerProducts.map(productCard)}
              </ShopRowSection>
            ) : null;
          case "new":
            return newProducts.length > 0 ? (
              <ShopRowSection key={key} title={dict.shop.newProducts} color="cyan" viewAll={viewAll("/new")} lang={lang}>
                {newProducts.map(productCard)}
              </ShopRowSection>
            ) : null;
          case "offers":
            return activeOffers.length > 0 ? (
              <ShopRowSection key={key} title={dict.offers.title} color="magenta" viewAll={viewAll("/offers")} lang={lang}>
                {activeOffers.map((offer) => (
                  <SectionCard key={offer.id} kind="offer" data={offer} lang={lang} dict={dict} categoryName={categoryName(offer.categoryId)} />
                ))}
              </ShopRowSection>
            ) : null;
          case "collections":
            return activeCollections.length > 0 ? (
              <ShopRowSection key={key} title={dict.collections.title} color="violet" viewAll={viewAll("/collections")} lang={lang}>
                {activeCollections.map((collection) => (
                  <SectionCard key={collection.id} kind="collection" data={collection} lang={lang} dict={dict} categoryName={categoryName(collection.categoryId)} />
                ))}
              </ShopRowSection>
            ) : null;
          case "brands":
            return shopBrands.length > 0 ? (
              <section key={key} id="brands" className="mb-8 scroll-mt-28">
                <ShopSectionHeading color="blue" viewAll={{ href: `/${lang}/brands`, label: dict.shop.viewAll }}>
                  {dict.shop.byBrand}
                </ShopSectionHeading>
                <BrandTiles brands={shopBrands} lang={lang} />
              </section>
            ) : null;
          case "category": {
            // A category's newest products, titled with its name.
            const category = categoryById.get(block.categoryId);
            const rowProducts = category ? pickCategoryRowProducts(category.id, liveCategories, liveProducts) : [];
            if (!category || rowProducts.length === 0) {
              return null;
            }
            const color = CATEGORY_SECTION_COLORS[categoryColorIndex++ % CATEGORY_SECTION_COLORS.length];
            return (
              <ShopRowSection
                key={key}
                title={pickLang(category.name, lang)}
                color={color}
                viewAll={viewAll(`/category/${category.slug}?categoryId=${category.id}`)}
                lang={lang}
              >
                {rowProducts.map(productCard)}
              </ShopRowSection>
            );
          }
          default:
            return null;
        }
      })}

      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
