import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ShopMediaStrip } from "@/components/shop/shop-media-strip";
import { AttributeRow, CategoryTiles, ShopHeading } from "@/components/shop/shop-tiles";
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

  const { categories, brands, characters, advices, shopMediaSections } = await loadShopPageData(lang);

  // Nothing here should lead to an empty page, so items without products stay out.
  const mainCategories = categories.filter((c) => c.parentId == null && !c.deletedAt && c.hasProducts !== false);
  const shopBrands = brands.filter((b) => b.hasProducts !== false);
  const shopCharacters = characters.filter((c) => c.hasProducts !== false);
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
    <main className="container pt-5">
      {media(1)}

      {mainCategories.length > 0 && (
        <section className="mb-14">
          <ShopHeading color="magenta">{dict.shop.byCategory}</ShopHeading>
          <CategoryTiles categories={mainCategories} lang={lang} />
        </section>
      )}

      {media(2)}

      {shopBrands.length > 0 && (
        <section className="mb-14">
          <ShopHeading color="blue">{dict.shop.byBrand}</ShopHeading>
          <AttributeRow items={shopBrands} lang={lang} basePath="brands" shape="plate" />
        </section>
      )}

      {media(3)}

      {shopCharacters.length > 0 && (
        <section className="mb-14">
          <ShopHeading color="violet">{dict.shop.byCharacter}</ShopHeading>
          <AttributeRow items={shopCharacters} lang={lang} basePath="characters" shape="round" />
        </section>
      )}

      {media(4)}

      <AdviceSection advices={advices} lang={lang} dict={dict} />

      {media(5)}
    </main>
  );
}
