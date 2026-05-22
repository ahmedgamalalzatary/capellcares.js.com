import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductGrid } from "@/components/products/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchAdvices, fetchCategories, fetchProducts } from "@/lib/api/client";
import { buildProductsMetadata } from "@/lib/seo";

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  return buildProductsMetadata(lang as Language);
}

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
        <span className="eyebrow">{lang === "ar" ? "مكتبة كابيلا" : "The Capella library"}</span>
        <h1>{lang === "ar" ? "عنايةٌ تشبهكِ، بصدق." : "Care that fits your ritual."}</h1>
        <p>
          {lang === "ar"
            ? "من ترطيب الجسد إلى لمسات المكياج الأخيرة، اختاري قطعةً واحدة وستفعل الكثير. مكوّناتٌ نظيفة، روائحُ هادئة، صناعةٌ مصرية."
            : "From body balms to a final flush of color, every piece is made to do quiet, honest work. Clean ingredients, soft scents, made in Egypt."}
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
