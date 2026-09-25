import type { Metadata } from "next";
import { pickLang } from "@capella/shared";
import { ProductDetail } from "@/components/products/product-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { buildCategoryHref } from "@/lib/category-links";
import {
  fetchProductBySlug,
  fetchProductDetailBySlug,
  fetchCategories,
  fetchOffers,
  fetchProducts,
  getCategoryById,
  getCategoryPath,
  getOffersForProduct
} from "@/lib/api/client";
import { requireStorefrontValue, resolveStorefrontSlugPageContext, StorefrontJsonLd } from "@/lib/storefront-detail-page";
import { breadcrumbJsonLd, buildProductMetadata, productJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const product = requireStorefrontValue(
    await fetchProductBySlug(slug, { lang }),
    (candidate) => !candidate || candidate.status !== "active" || Boolean(candidate.deletedAt)
  );
  const categories = await fetchCategories({ lang });
  const category = getCategoryById(categories, product.categoryId);
  const path = category ? getCategoryPath(categories, category.id) : [];
  return buildProductMetadata(lang, product, category, path);
}

export default async function ProductDetailsPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug, dict } = await resolveStorefrontSlugPageContext(params);
  const product = requireStorefrontValue(
    await fetchProductDetailBySlug(slug, { lang }),
    (candidate) => !candidate || candidate.status !== "active" || Boolean(candidate.deletedAt)
  );
  const [categories, allOffers, allProducts] = await Promise.all([
    fetchCategories({ lang }),
    fetchOffers({ lang }),
    fetchProducts({ lang })
  ]);
  const category = getCategoryById(categories, product.categoryId);
  const path = category ? getCategoryPath(categories, category.id) : [];
  const offers = getOffersForProduct(allOffers, allProducts, product.id);

  return (
    <main className="container">
      <StorefrontJsonLd payloads={[
        breadcrumbJsonLd([
          { name: dict.common.breadcrumbHome, url: `/${lang}/shop` },
          { name: dict.nav.products, url: `/${lang}/products` },
          ...path.map((c) => ({
            name: pickLang(c.name, lang),
            url: buildCategoryHref(lang, c)
          })),
          { name: pickLang(product.name, lang) }
        ]),
        productJsonLd(lang, product, category)
      ]} />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}/shop` },
          { label: dict.nav.products, href: `/${lang}/products` },
          ...path.map((c) => ({
            label: pickLang(c.name, lang),
            href: buildCategoryHref(lang, c)
          })),
          { label: pickLang(product.name, lang) }
        ]}
      />
      <ProductDetail
        product={product}
        offers={offers}
        lang={lang}
        dict={dict}
        categoryName={category ? pickLang(category.name, lang) : undefined}
        relatedItems={product.relatedItems ?? []}
      />
    </main>
  );
}
