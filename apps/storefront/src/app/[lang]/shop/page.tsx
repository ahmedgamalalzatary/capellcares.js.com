import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { BrandTiles, CategoryTiles, GenderTiles, ShopHeading } from "@/components/shop/shop-tiles";
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

  const { categories, brands, genders, advices, shopMediaSections } = await loadShopPageData(lang);

  // Nothing here should lead to an empty page, so items without products stay out.
  const mainCategories = categories.filter((c) => c.parentId == null && !c.deletedAt && c.hasProducts !== false);
  const shopBrands = brands.filter((brand) => brand.hasProducts !== false);
  const shopMediaBySlot = new Map(shopMediaSections.map((section) => [section.slot, section] as const));

  const media = (slot: 1 | 2 | 3 | 4 | 5) => (
    <ShopMediaStrip
      lang={lang}
      section={shopMediaBySlot.get(slot) ?? { id: -slot, slot, status: "inactive", items: [] }}
      label={dict.shopMedia.sectionLabel}
      priority={slot === 1}
    />
  );

  return (
    // The last section drops its bottom margin so the footer's own gap is the only space above it.
    <main className="container pt-5 [&>:last-child]:mb-0">
      {/* Phones show the first picture section above the genders; desktop keeps the genders on top. */}
      <div className="flex flex-col">
        {genders.length > 0 && (
          <GenderTiles genders={genders} lang={lang} label={dict.shop.byGender} className="max-[879px]:order-2 max-[879px]:mb-14" />
        )}
        <div className="max-[879px]:order-1 max-[879px]:[&>*]:mb-6">{media(1)}</div>
      </div>

      {mainCategories.length > 0 && (
        <section id="categories" className="mb-14 scroll-mt-28">
          <ShopHeading color="magenta">{dict.shop.byCategory}</ShopHeading>
          <CategoryTiles categories={mainCategories} lang={lang} />
        </section>
      )}

      {media(2)}

      {shopBrands.length > 0 && (
        <section id="brands" className="mb-14 scroll-mt-28">
          <ShopHeading color="blue">{dict.shop.byBrand}</ShopHeading>
          <BrandTiles brands={shopBrands} lang={lang} />
        </section>
      )}

      {media(3)}

      {media(4)}

      <AdviceSection advices={advices} lang={lang} dict={dict} />

      {media(5)}
    </main>
  );
}
