import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CategoryGrid } from "@/components/shop/shop-tiles";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadCategoriesPageData } from "@/lib/storefront-static-data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return { title: getDict(lang).nav.allCategories };
}

/** Every main category that has a picture, as a grid of the shop page's category cards. The mobile menu's "All Categories" leads here. */
export default async function CategoriesPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const categories = await loadCategoriesPageData(lang);

  // Main categories with a picture only; like the shop page, a deleted or empty category stays out so no card leads to an empty page.
  const shown = categories.filter(
    (category) => category.parentId == null && !category.deletedAt && category.hasProducts !== false && Boolean(category.imagePath)
  );

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}/shop` },
          { label: dict.nav.allCategories }
        ]}
      />
      <header className="page-head">
        <h1>{dict.nav.allCategories}</h1>
      </header>

      {shown.length > 0 ? (
        <CategoryGrid categories={shown} lang={lang} label={dict.nav.allCategories} />
      ) : (
        <p className="py-10 text-center text-(--ink-3)">{dict.common.empty}</p>
      )}
    </main>
  );
}
