import type { Metadata } from "next";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCategoryRow } from "@/components/shop/shop-category-row";
import { ShopRowSection } from "@/components/shop/shop-row-section";
import { buildCategoryHref } from "@/lib/category-links";
import { pickCategoryRowProducts } from "@/lib/shop-category-section";
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

  const { products, offers, collections, categories, advices, layout } = await loadShopPageData(lang);

  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  const activeCollections = collections.filter(
    (c) => c.status === "active" && c.visibility === "visible" && !c.deletedAt
  );
  const activeProducts = products.filter((p) => p.status === "active" && !p.deletedAt);
  const newProducts = activeProducts.filter((p) => p.isNew);
  const bestsellerProducts = activeProducts.filter((p) => p.isBestseller);
  // Active categories only: a card must never name a category the shop has deleted — the same rule the offers/collections grids apply.
  const liveCategories = categories.filter((c) => !c.deletedAt);
  const categoryById = new Map(liveCategories.map((c) => [c.id, c] as const));
  const categoryNameById = new Map(liveCategories.map((c) => [c.id, pickLang(c.name, lang)] as const));
  const productCard = (product: (typeof products)[number]) => (
    <ProductCard key={product.id} product={product} lang={lang} dict={dict} categoryName={categoryNameById.get(product.categoryId)} />
  );
  // The first picture section on the page loads its image first, as the top banner always has.
  const firstPictureBlockId = layout.find((block) => block.type === "media")?.id;

  return (
    <main className="container">
      {/* The sections in the order set in the ERP (Shop media → Page layout); the advices always close the page. */}
      {layout.map((block, index) => {
        const id = `shop-section-${block.id}`;
        switch (block.type) {
          case "media":
            return (
              <ShopMediaStrip
                key={id}
                lang={lang}
                section={block.mediaSection}
                label={dict.shopMedia.sectionLabel}
                flatTop={index === 0}
                priority={block.id === firstPictureBlockId}
              />
            );
          case "category_tiles":
            return <ShopCategoryRow key={id} categories={categories} lang={lang} title={dict.shop.categories} />;
          case "offers":
            return activeOffers.length > 0 ? (
              <ShopRowSection key={id} id={id} title={dict.offers.title} viewAll={{ href: `/${lang}/offers`, label: dict.shop.viewAllOffers }} lang={lang}>
                {activeOffers.map((offer) => (
                  <SectionCard
                    key={offer.id}
                    kind="offer"
                    data={offer}
                    lang={lang}
                    dict={dict}
                    categoryName={offer.categoryId != null ? categoryNameById.get(offer.categoryId) : undefined}
                  />
                ))}
              </ShopRowSection>
            ) : null;
          case "collections":
            return activeCollections.length > 0 ? (
              <ShopRowSection key={id} id={id} title={dict.collections.title} viewAll={{ href: `/${lang}/collections`, label: dict.shop.viewAllCollections }} lang={lang}>
                {activeCollections.map((collection) => (
                  <SectionCard
                    key={collection.id}
                    kind="collection"
                    data={collection}
                    lang={lang}
                    dict={dict}
                    categoryName={categoryNameById.get(collection.categoryId)}
                  />
                ))}
              </ShopRowSection>
            ) : null;
          case "bestsellers":
            return bestsellerProducts.length > 0 ? (
              <ShopRowSection key={id} id={id} title={dict.shop.bestsellers} viewAll={{ href: `/${lang}/bestsellers`, label: dict.shop.viewAllProducts }} mutedLink lang={lang}>
                {bestsellerProducts.map(productCard)}
              </ShopRowSection>
            ) : null;
          case "new":
            return newProducts.length > 0 ? (
              <ShopRowSection key={id} id={id} title={dict.shop.newProducts} viewAll={{ href: `/${lang}/new`, label: dict.shop.viewAllProducts }} lang={lang}>
                {newProducts.map(productCard)}
              </ShopRowSection>
            ) : null;
          case "category": {
            // A category's products in the shop's product order, titled with its name.
            const category = categoryById.get(block.categoryId);
            const rowProducts = category ? pickCategoryRowProducts(category.id, liveCategories, activeProducts) : [];
            if (!category || rowProducts.length === 0) {
              return null;
            }
            return (
              <ShopRowSection key={id} id={id} title={pickLang(category.name, lang)} viewAll={{ href: buildCategoryHref(lang, category), label: dict.shop.viewAllProducts }} lang={lang}>
                {rowProducts.map(productCard)}
              </ShopRowSection>
            );
          }
          default:
            return null;
        }
      })}

      {/* Capella Advices */}
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
