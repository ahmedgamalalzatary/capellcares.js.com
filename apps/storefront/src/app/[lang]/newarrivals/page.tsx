import { getDict, type Language } from "@minikoshk/shared";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getNewArrivals } from "@/lib/products";

/** New-arrivals grid; product cards click through to /products/[id]. */
export default async function NewArrivalsPage({ params }: { params: Promise<{ lang: string }> }) {
  const [{ lang }, newArrivals] = await Promise.all([params, getNewArrivals()]);
  const dict = getDict(lang as Language);
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <ProductGrid title={dict.pages.newArrivals} products={newArrivals} />
        </div>
      </main>
      <Footer />
    </>
  );
}
