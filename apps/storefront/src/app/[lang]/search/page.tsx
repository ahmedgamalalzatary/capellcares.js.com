import type { Metadata } from "next";
import Link from "next/link";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ProductCard } from "@/components/products/product-card";
import { SectionCard } from "@/components/shop/section-card";
import { ShopCardRow } from "@/components/shop/shop-card-row";
import { fetchAdvices, fetchCategories, fetchCollections, fetchOffers, fetchProducts } from "@/lib/api/client";
import { isSearchableBundle, matchesBilingualName } from "@/lib/storefront-search";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

/**
 * Global search results: the page behind the header dropdown's "View all".
 *
 * It carries every kind the dropdown previews — products, categories, offers and
 * collections — which /products?q= structurally could not. Products come back
 * already filtered by the catalog (their matching spans keywords too), while the
 * rest go through the same bilingual matcher the dropdown uses, so this page can
 * never contradict the preview that led here.
 */
export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const query = (await searchParams).q?.trim() ?? "";

  return {
    title: query ? dict.search.resultsFor.replace("{q}", query) : dict.search.title,
    // A per-query results page is not a landing page: keep it out of the index
    // so the catalog's own pages stay the ones that rank.
    robots: { index: false, follow: true }
  };
}

export default async function SearchPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const query = (await searchParams).q?.trim() ?? "";
  const isAr = lang === "ar";

  // Tips close the page either way, so they are fetched even for an empty query.
  const [[products, offers, collections, categories], advices] = await Promise.all([
    query
      ? Promise.all([
        fetchProducts({ lang, q: query }),
        fetchOffers({ lang }),
        fetchCollections({ lang }),
        fetchCategories({ lang })
      ])
      : Promise.resolve([[], [], [], []] as const),
    fetchAdvices({ lang }).catch(() => [])
  ]);

  const activeProducts = products.filter((product) => product.status === "active" && !product.deletedAt);
  const matchedOffers = offers.filter(
    (offer) => isSearchableBundle(offer) && matchesBilingualName(offer.name, query)
  );
  const matchedCollections = collections.filter(
    (collection) => isSearchableBundle(collection) && matchesBilingualName(collection.name, query)
  );
  // Categories are fetched to name each card's classification line, never listed
  // as results of their own.
  const categoryNameById = new Map(
    categories
      .filter((category) => !category.deletedAt)
      .map((category) => [category.id, pickLang(category.name, lang)] as const)
  );

  const total = activeProducts.length + matchedOffers.length + matchedCollections.length;

  const sectionHeading = (text: string) => (
    <header className="mb-6">
      <h2 className={isAr
        ? "m-0 text-[clamp(22px,2.2vw,32px)] font-bold font-(family-name:--font-ar) leading-tight text-ink"
        : "m-0 text-[clamp(24px,2.4vw,36px)] font-(--font-display) leading-[1.1] tracking-[-0.005em] text-ink"}>
        {text}
      </h2>
    </header>
  );

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.search.title }
        ]}
      />

      {!query ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.search.prompt}</p>
      ) : total === 0 ? (
        <div className="grid justify-items-center gap-4 py-12 text-center">
          <p className="m-0 text-(--ink-3)">{dict.search.empty.replace("{q}", query)}</p>
          <Link href={`/${lang}/products`} className="btn btn--primary">
            {dict.search.browseAll}
          </Link>
        </div>
      ) : (
        // One scrolling row per kind, exactly as the shop page presents them.
        <div className="grid gap-10 pb-8 sm:gap-12">
          {matchedOffers.length > 0 && (
            <section className="min-w-0">
              {sectionHeading(dict.ask.sections.offers)}
              <ShopCardRow lang={lang}>
                {matchedOffers.map((offer) => (
                  <SectionCard
                    key={offer.id}
                    kind="offer"
                    data={offer}
                    lang={lang}
                    dict={dict}
                    categoryName={offer.categoryId != null ? categoryNameById.get(offer.categoryId) : undefined}
                  />
                ))}
              </ShopCardRow>
            </section>
          )}

          {matchedCollections.length > 0 && (
            <section className="min-w-0">
              {sectionHeading(dict.ask.sections.collections)}
              <ShopCardRow lang={lang}>
                {matchedCollections.map((collection) => (
                  <SectionCard
                    key={collection.id}
                    kind="collection"
                    data={collection}
                    lang={lang}
                    dict={dict}
                    categoryName={categoryNameById.get(collection.categoryId)}
                  />
                ))}
              </ShopCardRow>
            </section>
          )}

          {activeProducts.length > 0 && (
            <section className="min-w-0">
              {sectionHeading(dict.ask.sections.products)}
              <ShopCardRow lang={lang}>
                {activeProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    lang={lang}
                    dict={dict}
                    categoryName={categoryNameById.get(product.categoryId)}
                  />
                ))}
              </ShopCardRow>
            </section>
          )}
        </div>
      )}

      {/* Capella Tips closes the page, whether or not the search found anything. */}
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
