import { notFound } from "next/navigation";
import { getDict, languages, mock, pickLang, type Language } from "@capella/shared";
import { ProductDetail } from "@/components/products/product-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default async function ProductDetailsPage({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const product = mock.getProductBySlug(slug);
  if (!product || product.status !== "active" || product.deletedAt) notFound();
  const dict = getDict(lang as Language);
  const category = mock.getCategoryById(product.categoryId);
  const path = category ? mock.getCategoryPath(category.id) : [];
  const offers = mock.getOffersForProduct(product.id);

  return (
    <main className="container">
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
