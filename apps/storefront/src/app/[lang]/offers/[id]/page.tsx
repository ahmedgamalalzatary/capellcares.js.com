import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BundleDetail } from "@/components/bundles/BundleDetail";
import { RelatedItems } from "@/components/products/RelatedItems";
import { getOfferBySlug } from "@/lib/bundles";

/** Offer detail page. `id` is the offer slug (`GET /api/v1/offers/:slug`). */
export default async function OfferDetailPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const offer = await getOfferBySlug(id);
  if (!offer || offer.status !== "active") {
    notFound();
  }
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <BundleDetail bundle={offer} kind="offer" />
        <RelatedItems items={offer.relatedItems} />
      </main>
      <Footer />
    </>
  );
}
