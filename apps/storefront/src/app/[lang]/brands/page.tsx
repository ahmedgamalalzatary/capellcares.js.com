import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BrandGrid } from "@/components/shop/shop-tiles";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadBrandsPageData } from "@/lib/storefront-static-data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return { title: getDict(lang).nav.allBrands };
}

/** Every brand that has products, as a grid of the shop page's brand plates. The shop page's brands "View all", the menu's "All Brands" and the footer's "Brands" lead here. */
export default async function BrandsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const brands = await loadBrandsPageData(lang);

  // Like the shop page, a brand with no products stays out so no plate leads to an empty page.
  const shown = brands.filter((brand) => brand.hasProducts !== false);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}/shop` },
          { label: dict.nav.allBrands }
        ]}
      />
      <header className="page-head">
        <h1>{dict.nav.allBrands}</h1>
      </header>

      {shown.length > 0 ? (
        <BrandGrid brands={shown} lang={lang} label={dict.nav.allBrands} />
      ) : (
        <p className="py-10 text-center text-(--ink-3)">{dict.common.empty}</p>
      )}
    </main>
  );
}
