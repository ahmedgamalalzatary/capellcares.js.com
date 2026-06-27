import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { CollectionGrid } from "@/components/collections/collection-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchCategories, fetchCollections } from "@/lib/api/client";
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
  const allCollections = await fetchCollections({ lang });
  const categories = await fetchCategories({ lang }).catch(() => []);
  const collections = allCollections.filter(
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
        <h1>{dict.collections.title}</h1>
      </header>

      <CollectionGrid collections={collections} categories={categories.filter((category) => !category.deletedAt)} lang={lang} dict={dict} />
    </main>
  );
}
