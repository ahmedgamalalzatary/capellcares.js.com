import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomepageSections } from "@/components/homepage/HomepageSections";
import { getHomepageBanners } from "@/lib/homepage-banners";
import { getCategories, selectShopByCategories } from "@/lib/categories";
import { getBestSellers, getNewArrivals } from "@/lib/products";

export default async function ShopPage() {
  const [homepageBanners, categories, newArrivals, bestSellers] = await Promise.all([
    getHomepageBanners(),
    getCategories(),
    getNewArrivals(),
    getBestSellers()
  ]);
  const shopByCategories = selectShopByCategories(categories);
  return (
    <>
      <Header />
      <main className="min-h-[40vh] bg-gray-50">
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
