import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, languages, pickLang, type Language } from "@capella/shared";
import { ProductDetail } from "@/components/products/product-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import {
  fetchProductBySlug,
  fetchCategories,
  fetchOffers,
  fetchProducts,
  getCategoryById,
  getCategoryPath,
  getOffersForProduct
} from "@/lib/api/client";
import { breadcrumbJsonLd, buildProductMetadata, productJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const product = await fetchProductBySlug(slug, { lang });
  if (!product || product.status !== "active" || product.deletedAt) notFound();
  const categories = await fetchCategories({ lang });
  const category = getCategoryById(categories, product.categoryId);
  const path = category ? getCategoryPath(categories, category.id) : [];
  return buildProductMetadata(lang as Language, product, category, path);
}

export default async function ProductDetailsPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const product = await fetchProductBySlug(slug, { lang });
  if (!product || product.status !== "active" || product.deletedAt) notFound();
  const dict = getDict(lang as Language);
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.common.breadcrumbHome, url: `/${lang}` },
              { name: dict.nav.products, url: `/${lang}/products` },
              ...path.map((c) => ({
                name: pickLang(c.name, lang as Language),
                url: `/${lang}/category/${c.slug}`
              })),
              { name: pickLang(product.name, lang as Language) }
            ])
          )
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(lang as Language, product, category)) }}
      />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products, href: `/${lang}/products` },
          ...path.map((c) => ({
            label: pickLang(c.name, lang as Language),
            href: `/${lang}/category/${c.slug}`
          })),
          { label: pickLang(product.name, lang as Language) }
        ]}
      />
      <ProductDetail product={product} offers={offers} lang={lang as Language} dict={dict} />
    </main>
  );
}
