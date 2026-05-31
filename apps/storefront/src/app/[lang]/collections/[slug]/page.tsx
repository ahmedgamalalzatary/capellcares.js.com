import type { Metadata } from "next";
import { pickLang } from "@capella/shared";
import { CollectionDetail } from "@/components/collections/collection-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchCategories, fetchCollectionBySlug, fetchCollectionDetailBySlug, fetchProducts } from "@/lib/api/client";
import { requireStorefrontValue, resolveStorefrontSlugPageContext, StorefrontJsonLd } from "@/lib/storefront-detail-page";
import { breadcrumbJsonLd, buildCollectionMetadata, collectionJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const collection = requireStorefrontValue(
    await fetchCollectionBySlug(slug, { lang }),
    (candidate) => !candidate || Boolean(candidate.deletedAt) || candidate.visibility !== "visible"
  );
  return buildCollectionMetadata(lang, collection);
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug, dict } = await resolveStorefrontSlugPageContext(params);
  const collection = requireStorefrontValue(
    await fetchCollectionDetailBySlug(slug, { lang }),
    (candidate) => !candidate || Boolean(candidate.deletedAt) || candidate.visibility !== "visible"
  );
  const [products, categories] = await Promise.all([fetchProducts({ lang }), fetchCategories({ lang })]);
  const category = categories.find((item) => item.id === collection.categoryId);

  const items = collection.items.map((item) => {
    const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === item.variantId));
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    return {
      qty: item.qty,
      variantId: item.variantId,
      product: product!,
      size: variant?.size ?? "",
      unitPrice: variant?.price ?? 0,
      available: variant?.stock ?? 0
    };
  }).filter((item) => item.product);

  return (
    <main className="container">
      <StorefrontJsonLd payloads={[
        breadcrumbJsonLd([
          { name: dict.common.breadcrumbHome, url: `/${lang}` },
          { name: dict.collections.title, url: `/${lang}/collections` },
          { name: pickLang(collection.name, lang) }
        ]),
        collectionJsonLd(lang, collection)
      ]} />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.collections.title, href: `/${lang}/collections` },
          { label: pickLang(collection.name, lang) }
        ]}
      />
      <CollectionDetail
        collection={collection}
        category={category}
        items={items}
        lang={lang}
        dict={dict}
        relatedItems={collection.relatedItems ?? []}
      />
    </main>
  );
}
