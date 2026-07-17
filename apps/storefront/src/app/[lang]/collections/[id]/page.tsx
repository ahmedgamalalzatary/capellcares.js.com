import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BundleDetail } from "@/components/bundles/BundleDetail";
import { RelatedItems } from "@/components/products/RelatedItems";
import { getCollectionBySlug } from "@/lib/bundles";

/** Collection detail page. `id` is the collection slug (`GET /api/v1/collections/:slug`). */
export default async function CollectionDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const collection = await getCollectionBySlug(id);
  if (!collection || collection.status !== "active") {
    notFound();
  }
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <BundleDetail bundle={collection} kind="collection" />
        <RelatedItems items={collection.relatedItems} />
      </main>
      <Footer />
    </>
  );
}
