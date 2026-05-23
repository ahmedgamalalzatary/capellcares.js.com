import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDict, formatPrice, languages, pickLang, type Language } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { fetchAdvices, fetchOffers, fetchProducts } from "@/lib/api/client";
import { buildShopMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  return buildShopMetadata(lang as Language);
}

export default async function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();

  const dict = getDict(lang as Language);
  const isAr = lang === "ar";

  const [products, offers, advices] = await Promise.all([
    fetchProducts({ lang }),
    fetchOffers({ lang }),
    fetchAdvices({ lang })
  ]);

  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  const featuredProducts = products.filter(
    (p) => p.status === "active" && !p.deletedAt && (p.isNew || p.isBestseller)
  );

  return (
    <main className="container">
      {/* Hero */}
      <header className="page-head">
        <span className="eyebrow !text-(--accent)">
          {isAr ? "متجر كابيلا" : "The Capella Shop"}
        </span>
        <h1>
          {isAr ? "كل ما تحتاجينه، في مكان واحد." : "Everything you need, in one place."}
        </h1>
        <p>
          {isAr
            ? "عروض مختارة، منتجات جديدة وأكثر مبيعًا، ونصائح عناية من كابيلا."
            : "Curated offers, new arrivals, bestsellers, and care advice — all from Capella."}
        </p>
      </header>

      {/* Offers */}
      {activeOffers.length > 0 && (
        <section className="mb-16">
          <header className="mb-8 flex items-end justify-between border-t border-(--hairline) pt-10">
            <div className="grid gap-1.5">
              <span className="eyebrow !text-(--accent)">
                {isAr ? "باقات كابيلا" : "Capella bundles"}
              </span>
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(--font-ar) leading-[1.25] text-(--ink)"
                : "m-0 text-[clamp(24px,2.4vw,36px)] italic font-(--font-display) leading-[1.1] tracking-[-0.005em] text-(--ink)"}>
                {dict.offers.title}
              </h2>
            </div>
            <Link
              href={`/${lang}/offers`}
              className={`shrink-0 text-[13px] text-(--accent) underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {isAr ? "كل العروض ←" : "View all →"}
            </Link>
          </header>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-7">
            {activeOffers.map((offer) => {
              const savings = offer.originalTotal - offer.price;
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
        </section>
      )}

      {/* New & Bestsellers */}
      {featuredProducts.length > 0 && (
        <section className="mb-16">
          <header className="mb-8 flex items-end justify-between border-t border-(--hairline) pt-10">
            <div className="grid gap-1.5">
              <span className="eyebrow">
                {isAr ? "الأحدث والأكثر مبيعًا" : "New & Bestsellers"}
              </span>
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(--font-ar) leading-[1.25] text-(--ink)"
                : "m-0 text-[clamp(24px,2.4vw,36px)] italic font-(--font-display) leading-[1.1] tracking-[-0.005em] text-(--ink)"}>
                {isAr ? "منتجات مميزة" : "Featured products"}
              </h2>
            </div>
            <Link
              href={`/${lang}/products`}
              className={`shrink-0 text-[13px] text-(--ink-2) underline-offset-4 hover:underline hover:text-ink ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {isAr ? "كل المنتجات ←" : "View all →"}
            </Link>
          </header>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang as Language} dict={dict} />
            ))}
          </div>
        </section>
      )}

      {/* Capella Advices */}
      <AdviceSection advices={advices} lang={lang as Language} dict={dict} />
    </main>
  );
}
