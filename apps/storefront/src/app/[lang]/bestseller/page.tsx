import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BestSellers } from "@/components/homepage/BestSellers";
import { getBestSellers } from "@/lib/products";

export default async function BestSellersPage() {
  const bestSellers = await getBestSellers();
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <BestSellers products={bestSellers} variant="grid" />
        </div>
      </main>
      <Footer />
    </>
  );
}
