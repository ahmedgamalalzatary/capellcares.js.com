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
    products = await fetchProducts({ lang });
  } catch (error) {
    console.error("Failed to load new products list", error);
  }
  try {
    categories = await fetchCategories({ lang });
  } catch (error) {
    console.error("Failed to load new products categories", error);
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
      <header className="page-head uppercase">
        <h1>{dict.badges.new}</h1>
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
