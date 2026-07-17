import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CartView } from "@/components/cart/CartView";

/** Client-side cart (the API has no cart resource; checkout receives the lines). */
export default function CartPage() {
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <div className="container">
          <CartView />
        </div>
      </main>
      <Footer />
    </>
  );
}
