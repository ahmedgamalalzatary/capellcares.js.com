import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

/** Checkout page posting to `POST /api/v1/checkout` (guest or logged-in). */
export default function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        <div className="container">
          <CheckoutForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
