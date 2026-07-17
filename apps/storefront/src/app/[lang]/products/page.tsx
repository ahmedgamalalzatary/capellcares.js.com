import { getDict, type Language } from "@minikoshk/shared";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductGrid } from "@/components/products/ProductGrid";
import { getProducts } from "@/lib/products";

/** Full catalog listing. `?q=` (header search) and `?category=` filter server-side via the API. */
export default async function ProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const dict = getDict(lang as Language);
  const products = await getProducts({ q: query.q, category: query.category });
  const title = query.q ? `${dict.pages.searchResultsFor} "${query.q}"` : dict.pages.products;
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container">
          <ProductGrid title={title} products={products.filter((product) => product.status === "active")} />
        </div>
      </main>
      <Footer />
    </>
  );
}
