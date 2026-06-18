import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionCard } from "@/components/shop/section-card";
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
        <div className="grid gap-5 pb-16 sm:grid-cols-2 sm:gap-6 sm:pb-24 lg:grid-cols-3 lg:gap-7">
          {collections.map((collection) => (
            <SectionCard key={collection.id} kind="collection" data={collection} lang={lang} dict={dict} />
          ))}
        </div>
      )}
    </main>
  );
}
