import type { Metadata } from "next";
import { pickLang } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CategoryPageContent } from "@/components/products/category-page-content";
import { buildCategoryHref } from "@/lib/category-links";
import {
  fetchCategories,
  fetchProducts,
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath
} from "@/lib/api/client";
import { requireStorefrontValue, resolveStorefrontSlugPageContext, StorefrontJsonLd } from "@/lib/storefront-detail-page";
import { buildCategoryMetadata, breadcrumbJsonLd } from "@/lib/seo";

function parseCategoryId(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ id?: string; categoryId?: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const sp = await searchParams;
  const categoryId = sp.categoryId ?? sp.id;
  const parsedCategoryId = parseCategoryId(categoryId);
  const [categories, products] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang, category: slug, categoryId })
  ]);
  const resolvedCategory = parsedCategoryId != null
    ? getCategoryById(categories, parsedCategoryId)
    : getCategoryBySlug(categories, slug);
  const category = requireStorefrontValue(resolvedCategory);
  const path = getCategoryPath(categories, category.id);
  return buildCategoryMetadata(lang, category, path, products.filter((p) => p.status === "active").length);
}

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ id?: string; categoryId?: string }>;
}) {
  const { lang, slug, dict } = await resolveStorefrontSlugPageContext(params);
  const sp = await searchParams;
  const categoryId = sp.categoryId ?? sp.id;
  const parsedCategoryId = parseCategoryId(categoryId);
  const [categories, products] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang, category: slug, categoryId })
  ]);
  const resolvedCategory = parsedCategoryId != null
    ? getCategoryById(categories, parsedCategoryId)
    : getCategoryBySlug(categories, slug);
  const category = requireStorefrontValue(resolvedCategory);
  const path = getCategoryPath(categories, category.id);
  const categoryName = pickLang(category.name, lang);
  const heading = category.isLeaf
    ? categoryName
    : dict.nav.viewAllCategory.replace("{name}", categoryName);
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
            url: i === path.length - 1 ? undefined : buildCategoryHref(lang, c)
          }))
        ])
      ]} />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products, href: `/${lang}/products` },
          ...path.map((c, i) => ({
            label: pickLang(c.name, lang),
            href: i === path.length - 1 ? undefined : buildCategoryHref(lang, c)
          }))
        ]}
      />
      <header className="page-head uppercase">
        <h1>{heading}</h1>
      </header>
      <CategoryPageContent
        category={category}
        subCats={subCats}
        products={products}
        lang={lang}
        dict={dict}
        categories={subtreeCategories}
      />
    </main>
  );
}
