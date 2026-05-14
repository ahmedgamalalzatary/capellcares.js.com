import { notFound } from "next/navigation";
import { getDict, languages, mock, pickLang, type Language } from "@capella/shared";
import { ProductGrid } from "@/components/products/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function CategoryPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const category = mock.getCategoryBySlug(slug);
  if (!category) notFound();
  const dict = getDict(lang as Language);

  const products = mock.getProductsByCategory(category.id);
  const path = mock.getCategoryPath(category.id);
  const subCats = mock.categories.filter((c) => c.parentId === category.id);

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
        categories={subCats.length > 0 ? subCats : mock.categories.filter((c) => c.parentId === null)}
        lang={lang as Language}
        dict={dict}
        initialCategory={subCats.length > 0 ? undefined : category.id}
        lockCategory={subCats.length === 0}
      />
    </main>
  );
}
