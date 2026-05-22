import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { OfferDetail } from "@/components/offers/offer-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchOfferBySlug, fetchProducts } from "@/lib/api/client";
import { breadcrumbJsonLd, buildOfferMetadata, offerJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const offer = await fetchOfferBySlug(slug, { lang });
  if (!offer || offer.deletedAt) notFound();
  return buildOfferMetadata(lang as Language, offer);
}

export default async function OfferDetailsPage({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const offer = await fetchOfferBySlug(slug, { lang });
  if (!offer || offer.deletedAt) notFound();
  const dict = getDict(lang as Language);
  const products = await fetchProducts({ lang });

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.common.breadcrumbHome, url: `/${lang}` },
              { name: dict.offers.title, url: `/${lang}/offers` },
              { name: offer.name[lang as Language] }
            ])
          )
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerJsonLd(lang as Language, offer)) }}
      />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.offers.title, href: `/${lang}/offers` },
          { label: offer.name[lang as Language] }
        ]}
      />
      <OfferDetail offer={offer} items={items} lang={lang as Language} dict={dict} />
    </main>
  );
}
