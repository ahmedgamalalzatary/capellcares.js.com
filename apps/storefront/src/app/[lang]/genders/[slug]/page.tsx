import type { Metadata } from "next";
import { getDict, pickLang } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CategoryComingSoon } from "@/components/products/category-coming-soon";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { fetchCategories, fetchGenders, fetchProducts } from "@/lib/api/client";
import { buildGenderMetadata } from "@/lib/seo";
import { requireStorefrontValue, resolveStorefrontSlugPageContext } from "@/lib/storefront-detail-page";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const gender = requireStorefrontValue((await fetchGenders({ lang })).find((item) => item.slug === slug));
  return buildGenderMetadata(lang, gender);
}

export default async function GenderPage({ params }: Props) {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const gender = requireStorefrontValue((await fetchGenders({ lang })).find((item) => item.slug === slug));
  const dict = getDict(lang);
  const name = pickLang(gender.name, lang);
  const [categories, products] = await Promise.all([fetchCategories({ lang }), fetchProducts({ lang })]);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}/shop` },
          { label: dict.nav.products, href: `/${lang}/products` },
          { label: name }
        ]}
      />
      <header className="page-head">
        <h1>{name}</h1>
      </header>
      {/* The shop page shows every gender, so one with no toys yet still needs a page to land on. */}
      {gender.hasProducts === false ? (
        <CategoryComingSoon lang={lang} dict={dict} />
      ) : (
        <ProductGrid
          products={products.filter((product) => product.status === "active" && product.genderIds?.includes(gender.id))}
          categories={categories.filter((category) => !category.deletedAt)}
          lang={lang}
          dict={dict}
        />
      )}
    </main>
  );
}
