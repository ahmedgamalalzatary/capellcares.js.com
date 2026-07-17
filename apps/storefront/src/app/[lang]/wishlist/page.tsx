import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { WishlistView } from "@/components/wishlist/WishlistView";

/** Wishlist page — local-first, mirrored to `/api/v1/wishlist` for logged-in customers. */
export default function WishlistPage() {
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <WishlistView />
        </div>
      </main>
      <Footer />
    </>
  );
}
