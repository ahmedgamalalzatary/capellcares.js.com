import { notFound } from "next/navigation";
import { getDict, languages, pickLang, type Language } from "@capella/shared";
import { ProductGrid } from "@/components/products/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  fetchCategories,
  fetchProducts,
  getCategoryBySlug,
  getCategoryPath,
  getProductsByCategory
} from "@/lib/api/client";

export default async function CategoryPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const [categories, allProducts] = await Promise.all([fetchCategories(), fetchProducts()]);
  const category = getCategoryBySlug(categories, slug);
  if (!category) notFound();
  const dict = getDict(lang as Language);

  const products = getProductsByCategory(allProducts.filter((p) => p.status === "active"), categories, category.id);
  const path = getCategoryPath(categories, category.id);
  const subCats = categories.filter((c) => c.parentId === category.id && !c.deletedAt);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products, href: `/${lang}/products` },
          ...path.map((c, i) => ({
            label: pickLang(c.name, lang as Language),
            href: i === path.length - 1 ? undefined : `/${lang}/category/${c.slug}`
          }))
        ]}
      />
      <header className="page-head">
        <span className="eyebrow">{path.map((c) => pickLang(c.name, lang as Language)).join(" · ")}</span>
        <h1>{pickLang(category.name, lang as Language)}</h1>
        {subCats.length > 0 && (
          <div className="pill-group" style={{ marginTop: 12 }}>
            {subCats.map((c) => (
              <a key={c.id} href={`/${lang}/category/${c.slug}`} className="chip">
                {pickLang(c.name, lang as Language)}
              </a>
            ))}
          </div>
        )}
      </header>
      <ProductGrid
        products={products}
        categories={subCats.length > 0 ? subCats : categories.filter((c) => c.parentId === null && !c.deletedAt)}
        lang={lang as Language}
        dict={dict}
        initialCategory={subCats.length > 0 ? undefined : category.id}
        lockCategory={subCats.length === 0}
      />
    </main>
  );
}
