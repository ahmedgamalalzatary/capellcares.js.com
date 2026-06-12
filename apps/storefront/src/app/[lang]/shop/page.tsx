import type { Metadata } from "next";
import Link from "next/link";
import { getDict, formatPrice, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
import { Icon } from "@/components/ui/icons";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { loadShopPageData } from "@/lib/storefront-static-data";
import { buildShopMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildShopMetadata(lang);
}

export default async function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const isAr = lang === "ar";

  const { products, offers, collections, advices } = await loadShopPageData(lang);

  const activeOffers = offers.filter((o) => o.status === "active" && !o.deletedAt);
  const activeCollections = collections.filter(
    (collection) => collection.status === "active" && collection.visibility === "visible" && !collection.deletedAt
  );
  const featuredProducts = products.filter(
    (p) => p.status === "active" && !p.deletedAt && (p.isNew || p.isBestseller)
  );

  return (
    <main className="container">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid items-center gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <p className="eyebrow text-(--gold-deep)!">{dict.home.heroEyebrow}</p>
            <h1 className={isAr
              ? "mt-5 m-0 text-[clamp(2.2rem,6vw,4.4rem)] font-bold font-(family-name:--font-ar) leading-[1.1] text-ink"
              : "mt-5 m-0 font-(--font-display) text-[clamp(2.4rem,6vw,4.8rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink"}>
              {dict.home.heroTitleBefore}
              <em className="gilt-text not-italic font-(--font-display) italic">{dict.home.heroTitleEm}</em>
              {dict.home.heroTitleAfter}
            </h1>
            <p className="mt-6 max-w-[44ch] text-lg leading-[1.6] text-(--ink-3)">{dict.home.heroLede}</p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link href={`/${lang}/products`} className="btn">{dict.home.heroCtaShop}</Link>
              <Link href={`/${lang}/new`} className="btn btn--outline-accent">{dict.home.heroCtaNew}</Link>
            </div>
          </div>
          <div className="hidden md:block">
            <div
              className="relative mx-auto aspect-4/5 w-full max-w-sm overflow-hidden rounded-lg p-1 shadow-(--shadow-gold)"
              style={{ background: "var(--gilt)" }}
            >
              <div className="grid h-full place-items-center rounded-[6px] bg-[radial-gradient(circle_at_50%_38%,var(--surface),var(--gold-tint))]">
                <Icon.Eye size={220} className="text-ink" style={{ filter: "drop-shadow(0 10px 24px rgba(120,90,10,.3))" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="mb-14 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-(--gold-line) bg-(--gold-line) sm:grid-cols-4">
        {Object.entries(dict.home.trust).map(([title, sub]) => (
          <div key={title} className="bg-canvas px-4 py-6 text-center">
            <strong className="block font-(--font-display) text-lg font-medium text-(--gold-deep)">{title}</strong>
            <span className={`mt-1 block text-xs text-(--ink-3) ${isAr ? "" : "uppercase tracking-[0.12em]"}`}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Offers */}
      {activeOffers.length > 0 && (
        <section className="mb-16">
          <header className="mb-8 flex items-end justify-between  pt-10">
            <div className="grid gap-1.5">
              <span className="eyebrow text-accent!">
                {dict.shop.bundlesEyebrow}
              </span>
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] italic font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.offers.title}
              </h2>
            </div>
            <Link
              href={`/${lang}/offers`}
              className={`shrink-0 text-sm text-accent underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllOffers}
            </Link>
          </header>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-7">
            {activeOffers.map((offer) => {
              const savings = offer.originalTotal - offer.price;
              return (
                <Link
                  key={offer.id}
                  href={`/${lang}/offers/${offer.slug}`}
                  className="group promo-card"
                >
                  <div className="promo-card__media aspect-16/10">
                    <OfferIllustration offer={offer} className="h-full w-full" />
                    <span className="promo-badge absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) px-3 py-1.5 text-xs tracking-[0.16em] uppercase inset-s-4">
                      ★ {dict.offers.badge}
                    </span>
                  </div>

                  <div className="grid gap-3 p-5 sm:p-6">
                    <h3 className={`m-0 leading-[1.15] ${isAr
                      ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
                      : "text-2xl italic font-(--font-display) text-ink"}`}>
                    {pickLang(offer.name, lang)}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-[1.65] text-(--ink-2)">
                      {pickLang(offer.description, lang)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2.5 border-t border-(--hairline) pt-4">
                      <span className={`leading-none text-accent ${isAr
                        ? "text-2xl font-bold font-(family-name:--font-ar)"
                        : "text-2xl italic font-(--font-display)"}`}>
                        {formatPrice(offer.price, lang)}
                      </span>
                      {savings > 0 && (
                        <>
                          <span className="text-sm text-(--ink-3) line-through">
                            {formatPrice(offer.originalTotal, lang)}
                          </span>
                          <span className="chip chip--accent">
                            {dict.offers.save.replace("{amount}", formatPrice(savings, lang))}
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

      {activeCollections.length > 0 && (
        <section className="mb-16">
          <header className="mb-8 flex items-end justify-between pt-10">
            <div className="grid gap-1.5">
              <span className="eyebrow text-accent!">
                {dict.shop.collectionsEyebrow}
              </span>
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] italic font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.collections.title}
              </h2>
            </div>
            <Link
              href={`/${lang}/collections`}
              className={`shrink-0 text-sm text-accent underline-offset-4 hover:underline ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllCollections}
            </Link>
          </header>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-7">
            {activeCollections.map((collection) => {
              const savings = collection.originalTotal - collection.price;
              return (
                <Link
                  key={collection.id}
                  href={`/${lang}/collections/${collection.slug}`}
                  className="group promo-card"
                >
                  <div className="promo-card__media aspect-16/10">
                    <CollectionIllustration collection={collection} lang={lang} className="h-full w-full" />
                    <span className="promo-badge absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) px-3 py-1.5 text-xs tracking-[0.16em] uppercase inset-s-4">
                      ★ {dict.collections.badge}
                    </span>
                  </div>

                  <div className="grid gap-3 p-5 sm:p-6">
                    <h3 className={`m-0 leading-[1.15] ${isAr
                      ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
                      : "text-2xl italic font-(--font-display) text-ink"}`}>
                      {pickLang(collection.name, lang)}
                    </h3>
                    <p className="line-clamp-2 text-sm leading-[1.65] text-(--ink-2)">
                      {pickLang(collection.description, lang)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-2.5 border-t border-(--hairline) pt-4">
                      <span className={`leading-none text-accent ${isAr
                        ? "text-2xl font-bold font-(family-name:--font-ar)"
                        : "text-2xl italic font-(--font-display)"}`}>
                        {formatPrice(collection.price, lang)}
                      </span>
                      {savings > 0 && (
                        <>
                          <span className="text-sm text-(--ink-3) line-through">
                            {formatPrice(collection.originalTotal, lang)}
                          </span>
                          <span className="chip chip--accent">
                            {dict.common.save} {formatPrice(savings, lang)}
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
          <header className="mb-8 flex items-end justify-between pt-10">
            <div className="grid gap-1.5">
              <span className="eyebrow">
                {dict.shop.newAndBestsellers}
              </span>
              <h2 className={isAr
                ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
                : "m-0 text-[clamp(24px,2.4vw,36px)] italic font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
                {dict.shop.featuredHeading}
              </h2>
            </div>
            <Link
              href={`/${lang}/products`}
              className={`shrink-0 text-sm text-(--ink-2) underline-offset-4 hover:underline hover:text-ink ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
            >
              {dict.shop.viewAllProducts}
            </Link>
          </header>

          <div className="grid gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
            ))}
          </div>
        </section>
      )}

      {/* Gold banner — the atelier */}
      <section className="mb-16">
        <div className="relative overflow-hidden rounded-lg shadow-(--shadow-gold)" style={{ background: "var(--gilt)" }}>
          <div className="grid min-h-[320px] items-center md:grid-cols-2">
            <div className="p-10 sm:p-14">
              <div className={`text-xs text-ink/70 ${isAr ? "" : "uppercase tracking-[0.4em]"}`}>{dict.home.bannerIdx}</div>
              <h2 className={isAr
                ? "mt-4 m-0 text-[clamp(1.7rem,3.8vw,2.8rem)] font-bold font-(family-name:--font-ar) leading-[1.15] text-ink"
                : "mt-4 m-0 font-(--font-display) text-[clamp(1.8rem,3.8vw,3rem)] font-medium leading-[1.08] text-ink"}>
                {dict.home.bannerTitleBefore}
                <em className={isAr ? "" : "italic"}>{dict.home.bannerTitleEm}</em>
              </h2>
              <p className="mt-5 max-w-[42ch] leading-[1.7] text-ink/75">{dict.home.bannerText}</p>
              <Link href={`/${lang}/products`} className="btn btn--primary mt-7">{dict.home.bannerCta}</Link>
            </div>
            <div className="hidden place-items-center p-10 md:grid">
              <Icon.Eye size={190} className="text-ink/90" />
            </div>
          </div>
        </div>
      </section>

      {/* Atelier journal */}
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
