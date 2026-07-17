import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductVariantSelector } from "@/components/products/ProductVariantSelector";
import { ProductInfoSections } from "@/components/products/ProductInfoSections";
import { RelatedItems } from "@/components/products/RelatedItems";
import { getProductBySlug } from "@/lib/products";

type ProductSearchParams = { size?: string; color?: string; variant?: string };

function numericParam(value?: string) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

/** Product detail page. `id` is the product slug (`GET /api/v1/products/:slug`). */
export default async function ProductDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<ProductSearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await getProductBySlug(id);
  if (!product || product.status !== "active") {
    notFound();
  }
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <ProductVariantSelector
          product={product}
          initialSizeId={numericParam(query.size)}
          initialColorId={numericParam(query.color)}
          initialVariantId={numericParam(query.variant)}
        />
        <ProductInfoSections product={product} />
        <RelatedItems items={product.relatedItems} />
      </main>
      <Footer />
    </>
  );
}
