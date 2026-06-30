import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionCard } from "@/components/shop/section-card";
import { fetchOffers } from "@/lib/api/client";
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

      {offers.length === 0 ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.offers.listEmpty}</p>
      ) : (
        <div className="grid gap-5 pb-16 sm:grid-cols-2 sm:gap-6 sm:pb-24 lg:grid-cols-3 lg:gap-7">
          {offers.map((offer) => (
            <SectionCard key={offer.id} kind="offer" data={offer} lang={lang} dict={dict} />
          ))}
        </div>
      )}
    </main>
  );
}
