import { getDict, type Language } from "@minikoshk/shared";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getBestSellers } from "@/lib/products";

/** Best-sellers grid; product cards click through to /products/[id]. */
export default async function BestSellersPage({ params }: { params: Promise<{ lang: string }> }) {
  const [{ lang }, bestSellers] = await Promise.all([params, getBestSellers()]);
  const dict = getDict(lang as Language);
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <ProductGrid title={dict.pages.bestSellers} products={bestSellers} />
        </div>
      </main>
      <Footer />
    </>
  );
}
