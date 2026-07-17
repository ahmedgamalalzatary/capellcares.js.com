import { getDict, type Language } from "@minikoshk/shared";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BundleCard } from "@/components/bundles/BundleCard";
import { getCollections } from "@/lib/bundles";

/** Collection listing (`GET /api/v1/collections`). */
export default async function CollectionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const [{ lang }, collections] = await Promise.all([params, getCollections()]);
  const dict = getDict(lang as Language);
  return (
    <>
      <Header />
      <main className="min-h-[40vh]">
        <div className="container py-8">
          <h1 className="mb-6 text-2xl font-extrabold uppercase tracking-[0.15em] text-brand-dark">{dict.pages.collections}</h1>
          {collections.length === 0 ? (
            <p className="py-12 text-center text-gray-500">{dict.pages.noResults}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
              {collections.map((collection) => (
                <BundleCard key={collection.id} bundle={collection} kind="collection" />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
