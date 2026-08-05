import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OfferGrid } from "@/components/offers/offer-grid";
import { fetchCategories, fetchOffers } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { buildOffersMetadata, breadcrumbJsonLd } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildOffersMetadata(lang);
}

export default async function OffersPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const offers = await fetchOffers({ lang });
  const categories = await fetchCategories({ lang }).catch(() => []);

  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.common.breadcrumbHome, url: `/${lang}` },
              { name: dict.offers.title }
            ])
          )
        }}
      />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.offers.title }
        ]}
      />
      <header className="page-head uppercase">
        <h1>{dict.offers.title}</h1>
      </header>

      <OfferGrid offers={offers} categories={categories.filter((category) => !category.deletedAt)} lang={lang} dict={dict} />
    </main>
  );
}
