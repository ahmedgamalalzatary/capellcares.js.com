import type { Metadata } from "next";
import { pickLang } from "@capella/shared";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  fetchCategories,
  fetchProducts,
  getCategoryBySlug,
  getCategoryPath,
  getProductsByCategory
} from "@/lib/api/client";
import { requireStorefrontValue, resolveStorefrontSlugPageContext, StorefrontJsonLd } from "@/lib/storefront-detail-page";
import { buildCategoryMetadata, breadcrumbJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const [categories, allProducts] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang })
  ]);
  const category = requireStorefrontValue(getCategoryBySlug(categories, slug));
  const products = getProductsByCategory(allProducts.filter((p) => p.status === "active"), categories, category.id);
  const path = getCategoryPath(categories, category.id);
  return buildCategoryMetadata(lang, category, path, products.length);
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug, dict } = await resolveStorefrontSlugPageContext(params);
  const [categories, allProducts] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang })
  ]);
  const category = requireStorefrontValue(getCategoryBySlug(categories, slug));

  const products = getProductsByCategory(allProducts.filter((p) => p.status === "active"), categories, category.id);
  const path = getCategoryPath(categories, category.id);
  const subCats = categories.filter((c) => c.parentId === category.id && !c.deletedAt);
  const subtreeCategoryIds = new Set<number>([category.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of categories) {
      if (!candidate.deletedAt && candidate.parentId != null && subtreeCategoryIds.has(candidate.parentId) && !subtreeCategoryIds.has(candidate.id)) {
        subtreeCategoryIds.add(candidate.id);
        changed = true;
      }
    }
  }
  const subtreeCategories = categories.filter((candidate) => !candidate.deletedAt && subtreeCategoryIds.has(candidate.id));

  return (
    <main className="container">
      <StorefrontJsonLd payloads={[
        breadcrumbJsonLd([
          { name: dict.common.breadcrumbHome, url: `/${lang}` },
          { name: dict.nav.products, url: `/${lang}/products` },
          ...path.map((c, i) => ({
            name: pickLang(c.name, lang),
            url: i === path.length - 1 ? undefined : `/${lang}/category/${c.slug}`
          }))
        ])
      ]} />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products, href: `/${lang}/products` },
          ...path.map((c, i) => ({
            label: pickLang(c.name, lang),
            href: i === path.length - 1 ? undefined : `/${lang}/category/${c.slug}`
          }))
        ]}
      />
      <header className="page-head">
        <span className="eyebrow">{path.map((c) => pickLang(c.name, lang)).join(" · ")}</span>
        <h1>{pickLang(category.name, lang)}</h1>
        {subCats.length > 0 && (
          <div className="pill-group" style={{ marginTop: 12 }}>
            {subCats.map((c) => (
              <a key={c.id} href={`/${lang}/category/${c.slug}`} className="chip">
                {pickLang(c.name, lang)}
              </a>
            ))}
          </div>
        )}
      </header>
      <ProductGrid
        products={products}
        categories={subtreeCategories}
        lang={lang}
        dict={dict}
        initialCategory={category.id}
        lockCategory={false}
      />
    </main>
  );
}
