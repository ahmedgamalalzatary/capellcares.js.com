import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { ProductCard } from "@/components/products/product-card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchProducts } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);
  return { title: dict.nav.bestsellers };
}

export default async function BestsellersPage({ params }: { params: Promise<{ lang: string }> }) {
  const lang = await resolveStorefrontLang(params);
  const dict = getDict(lang);

  let products: Awaited<ReturnType<typeof fetchProducts>> = [];
  try {
    products = await fetchProducts({ lang });
  } catch (error) {
    console.error("Failed to load bestsellers", error);
  }
  const bestsellers = products.filter((p) => p.status === "active" && !p.deletedAt && p.isBestseller);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.bestsellers }
        ]}
      />
      <header className="page-head">
        <h1>{dict.nav.bestsellers}</h1>
      </header>

      {bestsellers.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {bestsellers.map((product) => (
            <ProductCard key={product.id} product={product} lang={lang} dict={dict} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-(--ink-3)">{dict.common.empty}</p>
      )}
    </main>
  );
}
