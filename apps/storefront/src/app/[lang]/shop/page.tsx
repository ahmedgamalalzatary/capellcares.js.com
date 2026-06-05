import type { Metadata } from "next";
import Link from "next/link";
import { getDict, formatPrice, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductCard } from "@/components/products/product-card";
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
                  className="group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)"
                >
                  <div className="relative aspect-16/10 bg-[radial-gradient(120%_120%_at_50%_0%,var(--warm-soft),var(--surface))]">
                    <OfferIllustration offer={offer} className="h-full w-full" />
                    <span className="absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-accent px-3 py-1.5 text-xs tracking-[0.16em] uppercase text-canvas inset-s-4">
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
          <header className="mb-8 flex items-end justify-between border-t border-(--hairline) pt-10">
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
                  className="group grid overflow-hidden rounded-lg border border-(--hairline) bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-warm hover:shadow-(--shadow-2)"
                >
                  <div className="relative aspect-16/10 bg-[radial-gradient(120%_120%_at_50%_0%,var(--warm-soft),var(--surface))]">
                    <CollectionIllustration collection={collection} lang={lang} className="h-full w-full" />
                    <span className="absolute top-4 inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-accent px-3 py-1.5 text-xs tracking-[0.16em] uppercase text-canvas inset-s-4">
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
          <header className="mb-8 flex items-end justify-between border-t border-(--hairline) pt-10">
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

          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
            ))}
          </div>
        </section>
      )}

      {/* Capella Advices */}
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
