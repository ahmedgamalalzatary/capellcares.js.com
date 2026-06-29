import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchCategories, fetchProducts } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  return { title: dict.nav.new };
}

export default async function NewProductsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);

  let products: Awaited<ReturnType<typeof fetchProducts>> = [];
  let categories: Awaited<ReturnType<typeof fetchCategories>> = [];
  try {
    [products, categories] = await Promise.all([fetchProducts({ lang }), fetchCategories({ lang })]);
  } catch (error) {
    console.error("Failed to load new products", error);
  }
  const newProducts = products.filter((p) => p.status === "active" && !p.deletedAt && p.isNew);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.new }
        ]}
      />
      <header className="page-head">
        <h1>{dict.nav.new}</h1>
      </header>

      <ProductGrid
        products={newProducts}
        categories={categories.filter((c) => !c.deletedAt)}
        lang={lang}
        dict={dict}
      />
    </main>
  );
}
