import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { HomepageSections } from "@/components/homepage/HomepageSections";
import { getHomepageBanners } from "@/lib/homepage-banners";

export default async function HomePage() {
  const homepageBanners = await getHomepageBanners();
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <HomepageSections sections={homepageBanners.sections} />
      </main>
      <Footer />
    </>
  );
}
