import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomepageSections } from "@/components/homepage/HomepageSections";
import { getHomepageBanners } from "@/lib/homepage-banners";
import { getCategories, selectShopByCategories } from "@/lib/categories";

export default async function ShopPage() {
  const [homepageBanners, categories] = await Promise.all([getHomepageBanners(), getCategories()]);
  const shopByCategories = selectShopByCategories(categories);
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <HomepageSections sections={homepageBanners.sections} shopByCategories={shopByCategories} />
      </main>
      <Footer />
    </>
  );
}
