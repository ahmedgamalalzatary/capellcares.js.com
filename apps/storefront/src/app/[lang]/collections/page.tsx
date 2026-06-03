import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice, getDict, pickLang } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CollectionIllustration } from "@/components/ui/collection-illustration";
import { fetchCollections } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { breadcrumbJsonLd, buildCollectionsMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildCollectionsMetadata(lang);
}

export default async function CollectionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  const collections = (await fetchCollections({ lang })).filter(
    (collection) => collection.status === "active" && collection.visibility === "visible" && !collection.deletedAt
  );

  return (
    <main className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.common.breadcrumbHome, url: `/${lang}` },
              { name: dict.collections.title }
            ])
          )
        }}
      />
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.collections.title }
        ]}
      />
      <header className="page-head">
        <span className="eyebrow text-accent!">{lang === "ar" ? "مجموعات كابيلا" : "Capella collections"}</span>
        <h1>{dict.collections.title}</h1>
        <p className="max-w-[62ch] text-(--ink-2)">
          {lang === "ar"
            ? "اختيارات جاهزة حسب القسم، تضم أكثر من منتج في روتين واحد بسعر مجمع."
            : "Ready-made sets built around one category, combining multiple products into one complete routine."}
        </p>
      </header>

      {collections.length === 0 ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.collections.listEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 pb-16 sm:grid-cols-2 sm:gap-6 sm:pb-24 lg:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] lg:gap-7">
          {collections.map((collection) => {
            const savings = collection.originalTotal - collection.price;
            const isAr = lang === "ar";
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
                  <h2 className={`m-0 leading-[1.15] ${isAr
                    ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
                    : "text-2xl italic font-(--font-display) text-ink"}`}>
                    {pickLang(collection.name, lang)}
                  </h2>
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
      )}
    </main>
  );
}
