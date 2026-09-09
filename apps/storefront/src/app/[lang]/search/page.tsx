import type { Metadata } from "next";
import Link from "next/link";
import { getDict, pickLang } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SearchResults } from "@/components/search/search-results";
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
  const categoryNames = Object.fromEntries(
    categories
      .filter((category) => !category.deletedAt)
      .map((category) => [String(category.id), pickLang(category.name, lang)] as const)
  );

  const total = activeProducts.length + matchedOffers.length + matchedCollections.length;

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
        <SearchResults
          products={activeProducts}
          offers={matchedOffers}
          collections={matchedCollections}
          categoryNames={categoryNames}
          lang={lang}
          dict={dict}
        />
      )}

      {/* Capella Tips closes the page, whether or not the search found anything. */}
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
