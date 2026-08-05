import type { Metadata } from "next";
import { pickLang } from "@capella/shared";
import { OfferDetail } from "@/components/offers/offer-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchCategories, fetchOfferBySlug, fetchOfferDetailBySlug, fetchProducts } from "@/lib/api/client";
import { requireStorefrontValue, resolveStorefrontSlugPageContext, StorefrontJsonLd } from "@/lib/storefront-detail-page";
import { breadcrumbJsonLd, buildOfferMetadata, offerJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const offer = requireStorefrontValue(await fetchOfferBySlug(slug, { lang }), (candidate) => !candidate || Boolean(candidate.deletedAt));
  return buildOfferMetadata(lang, offer);
}

export default async function OfferDetailsPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug, dict } = await resolveStorefrontSlugPageContext(params);
  const offer = requireStorefrontValue(await fetchOfferDetailBySlug(slug, { lang }), (candidate) => !candidate || Boolean(candidate.deletedAt));
  // The category is only a label here, so a failed fetch must not take the whole
  // page down with it — same handling as the offers index.
  const [products, categories] = await Promise.all([
    fetchProducts({ lang }),
    fetchCategories({ lang }).catch(() => [])
  ]);
  const category = offer.categoryId != null
    ? categories.find((item) => item.id === offer.categoryId && !item.deletedAt)
    : undefined;

  const items = offer.items.map((it) => {
    const product = products.find((p) => p.variants.some((v) => v.id === it.variantId));
    const variant = product?.variants.find((v) => v.id === it.variantId);
    return {
      qty: it.qty,
      variantId: it.variantId,
      product: product!,
      size: variant?.size ?? "",
      unitPrice: variant?.price ?? 0,
      available: variant?.stock ?? 0
    };
  }).filter((it) => it.product);

  return (
    <main className="container">
      <StorefrontJsonLd payloads={[
        breadcrumbJsonLd([
          { name: dict.common.breadcrumbHome, url: `/${lang}` },
          { name: dict.offers.title, url: `/${lang}/offers` },
          { name: pickLang(offer.name, lang) }
        ]),
        offerJsonLd(lang, offer)
      ]} />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.offers.title, href: `/${lang}/offers` },
          { label: pickLang(offer.name, lang) }
        ]}
      />
      <OfferDetail
        offer={offer}
        category={category}
        items={items}
        lang={lang}
        dict={dict}
        relatedItems={offer.relatedItems ?? []}
      />
    </main>
  );
}
