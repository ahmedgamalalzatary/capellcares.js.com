import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchAdvices, fetchCategories, fetchProducts } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { buildProductsMetadata } from "@/lib/seo";

function parseCategoryId(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; categoryId?: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildProductsMetadata(lang);
}

export default async function ProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; categoryId?: string }>;
}) {
  const lang = await resolveStorefrontLang(params);
  const sp = await searchParams;
  const dict = getDict(lang);

  const [categories, products, advices] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang, category: sp.category, categoryId: sp.categoryId }),
    fetchAdvices({ lang })
  ]);
  const activeProducts = products.filter((p) => p.status === "active");
  const parsedCategoryId = parseCategoryId(sp.categoryId);
  const initialCategory = parsedCategoryId != null
    ? categories.find((category) => category.id === parsedCategoryId)?.id
    : sp.category
      ? categories.find((category) => category.slug === sp.category)?.id
      : undefined;

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products }
        ]}
      />
      <header className="page-head">
        <h1>{dict.nav.allProducts}</h1>
      </header>
      <ProductGrid
        products={activeProducts}
        categories={categories.filter((c) => !c.deletedAt)}
        lang={lang}
        dict={dict}
        initialSearch={sp.q ?? ""}
        initialCategory={initialCategory}
      />
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
