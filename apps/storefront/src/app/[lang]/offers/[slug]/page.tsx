import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { OfferDetail } from "@/components/offers/offer-detail";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchOfferBySlug, fetchProducts } from "@/lib/api/client";

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
