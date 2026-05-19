import { notFound } from "next/navigation";
import Link from "next/link";
import { getDict, formatPrice, languages, pickLang, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { fetchOffers } from "@/lib/api/client";

export default async function OffersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);
  const offers = await fetchOffers({ lang });

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.offers.title }
        ]}
      />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "العروض الحصرية" : "Exclusive bundles"}</span>
        <h1>{dict.offers.title}</h1>
        <p className="max-w-[60ch] text-(--ink-2)">
          {lang === "ar"
            ? "باقات مختارة بعناية وبسعر باقة موفر، لتأخذي روتينك إلى المستوى التالي."
            : "Carefully curated bundles at a bundle price — your routine, upgraded."}
        </p>
      </header>

      {offers.length === 0 ? (
        <p className="text-(--ink-2)">{dict.offers.listEmpty}</p>
      ) : (
        <div className="grid gap-6 pb-20 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {offers.map((offer) => {
            const savings = offer.originalTotal - offer.price;
            return (
              <Link
                key={offer.id}
                href={`/${lang}/offers/${offer.slug}`}
                className="grid overflow-hidden rounded-[16px] border border-(--hairline) bg-(--bg-elev) transition duration-200 hover:-translate-y-0.5 hover:shadow-(--shadow-1)"
              >
                <div className="relative aspect-16/10">
                  <OfferIllustration offer={offer} className="h-full w-full" />
                  <span className="badge badge--offer absolute top-3.5 left-3.5">
                    {dict.offers.badge}
                  </span>
                </div>

                <div className="grid gap-2 p-5">
                  <h3 className="m-0 text-[22px] font-(--font-display) leading-tight">
                    {pickLang(offer.name, lang as Language)}
                  </h3>
                  <p className="text-[13px] text-(--ink-2)">
                    {pickLang(offer.description, lang as Language)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-[22px] font-(--font-display)">{formatPrice(offer.price, lang as Language)}</span>
                    {savings > 0 && (
                      <>
                        <span className="text-sm text-(--ink-3) line-through">
                          {formatPrice(offer.originalTotal, lang as Language)}
                        </span>
                        <span className="chip chip--accent">
                          {dict.offers.save.replace("{amount}", formatPrice(savings, lang as Language))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

