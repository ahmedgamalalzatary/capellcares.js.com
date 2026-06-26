import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { NewArrivals } from "@/components/homepage/NewArrivals";
import { getNewArrivals } from "@/lib/products";

export default async function NewArrivalsPage() {
  const newArrivals = await getNewArrivals();
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <NewArrivals products={newArrivals} variant="grid" />
        </div>
      </main>
      <Footer />
    </>
  );
}
