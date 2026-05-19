import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductGrid } from "@/components/products/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchAdvices, fetchCategories, fetchProducts } from "@/lib/api/client";

export default async function ProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const sp = await searchParams;
  const dict = getDict(lang as Language);

  const [products, categories, advices] = await Promise.all([
    fetchProducts({ lang }),
    fetchCategories({ lang }),
    fetchAdvices({ lang })
  ]);
  const activeProducts = products.filter((p) => p.status === "active");

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.nav.products }
        ]}
      />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "كل المنتجات" : "All products"}</span>
        <h1>{lang === "ar" ? "اختاري عناية تشبهك" : "Care that fits your ritual."}</h1>
        <p className="muted" style={{ maxWidth: "60ch" }}>
          {lang === "ar"
            ? "اكتشفي مجموعتنا الكاملة من المنتجات: من ترطيب الجسم حتى لمسات المكياج النهائية."
            : "Browse our full range — body, skin, hair, and the finishing details that complete the routine."}
        </p>
      </header>
      <ProductGrid
        products={activeProducts}
        categories={categories.filter((c) => !c.deletedAt)}
        lang={lang as Language}
        dict={dict}
        initialSearch={sp.q ?? ""}
        initialCategory={sp.category ? Number(sp.category) : undefined}
      />
      <AdviceSection advices={advices} lang={lang as Language} dict={dict} />
    </main>
  );
}
