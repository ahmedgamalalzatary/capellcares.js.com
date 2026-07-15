import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomepageSections } from "@/components/homepage/HomepageSections";
import { ProductVariantSelector } from "@/components/products/ProductVariantSelector";
import { getHomepageBanners } from "@/lib/homepage-banners";
import { getCategories, selectShopByCategories } from "@/lib/categories";
import { getBestSellers, getNewArrivals, getProductBySlug } from "@/lib/products";

type ShopSearchParams = { product?: string; size?: string; color?: string; variant?: string };

function numericParam(value?: string) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

export default async function ShopPage({
  searchParams
}: { searchParams: Promise<ShopSearchParams> }) {
  const query = await searchParams;
  const [homepageBanners, categories, newArrivals, bestSellers, selectedProduct] = await Promise.all([
    getHomepageBanners(),
    getCategories(),
    getNewArrivals(),
    getBestSellers(),
    query.product ? getProductBySlug(query.product) : Promise.resolve(null)
  ]);
  const shopByCategories = selectShopByCategories(categories);
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
        {selectedProduct && <ProductVariantSelector
          product={selectedProduct}
          initialSizeId={numericParam(query.size)}
          initialColorId={numericParam(query.color)}
          initialVariantId={numericParam(query.variant)}
        />}
        <HomepageSections
          sections={homepageBanners.sections}
          shopByCategories={shopByCategories}
          newArrivals={newArrivals}
          bestSellers={bestSellers}
        />
      </main>
      <Footer />
    </>
  );
}
