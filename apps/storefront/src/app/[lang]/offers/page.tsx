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
        <span className="eyebrow !text-(--accent)">{lang === "ar" ? "باقات كابيلا" : "Capella bundles"}</span>
        <h1>{dict.offers.title}</h1>
        <p className="max-w-[62ch] text-(--ink-2)">
          {lang === "ar"
            ? "باقات مختارة بعناية، بسعرٍ أوفر، لروتينٍ يكتمل بقطعةٍ واحدة."
            : "Considered rituals, bundled to make your routine simpler — and softer on the wallet."}
        </p>
      </header>

      {offers.length === 0 ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.offers.listEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 pb-16 sm:grid-cols-2 sm:gap-6 sm:pb-24 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-7">
          {offers.map((offer) => {
            const savings = offer.originalTotal - offer.price;
            const isAr = lang === "ar";
            return (
              <Link
                key={offer.id}
                href={`/${lang}/offers/${offer.slug}`}
                className="group grid overflow-hidden rounded-(--radius-lg) border border-(--hairline) bg-(--surface) transition-all duration-200 hover:-translate-y-0.5 hover:border-(--warm) hover:shadow-(--shadow-2)"
              >
                <div className="relative aspect-16/10 bg-[radial-gradient(120%_120%_at_50%_0%,var(--warm-soft),var(--surface))]">
                  <OfferIllustration offer={offer} className="h-full w-full" />
                  <span className="absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-(--accent) px-3 py-1.5 text-[10px] tracking-[0.16em] uppercase text-(--canvas) start-4">
                    ★ {dict.offers.badge}
                  </span>
                </div>

                <div className="grid gap-3 p-5 sm:p-6">
                  <h3 className={`m-0 leading-[1.15] ${isAr
                    ? "text-[22px] font-bold font-(--font-ar) text-(--ink)"
                    : "text-[26px] italic font-(--font-display) text-(--ink)"}`}>
                    {pickLang(offer.name, lang as Language)}
                  </h3>
                  <p className="line-clamp-2 text-[13.5px] leading-[1.65] text-(--ink-2)">
                    {pickLang(offer.description, lang as Language)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-2.5 border-t border-(--hairline) pt-4">
                    <span className={`leading-none text-(--accent) ${isAr
                      ? "text-[24px] font-bold font-(--font-ar)"
                      : "text-[26px] italic font-(--font-display)"}`}>
                      {formatPrice(offer.price, lang as Language)}
                    </span>
                    {savings > 0 && (
                      <>
                        <span className="text-[13px] text-(--ink-3) line-through">
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

