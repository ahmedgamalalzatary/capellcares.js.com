import type { Metadata } from "next";
import { getDict } from "@capella/shared";
import { AdviceSection } from "@/components/products/advice-section";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fetchAdvices, fetchCategories, fetchProducts } from "@/lib/api/client";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";
import { buildProductsMetadata } from "@/lib/seo";

function parseCategoryId(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; categoryId?: string }>;
}): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildProductsMetadata(lang);
}

export default async function ProductsPage({
  params,
  searchParams
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; categoryId?: string }>;
}) {
  const lang = await resolveStorefrontLang(params);
  const sp = await searchParams;
  const dict = getDict(lang);

  const [categories, products, advices] = await Promise.all([
    fetchCategories({ lang }),
    fetchProducts({ lang, category: sp.category, categoryId: sp.categoryId }),
    fetchAdvices({ lang })
  ]);
  const activeProducts = products.filter((p) => p.status === "active");
  const parsedCategoryId = parseCategoryId(sp.categoryId);
  const initialCategory = parsedCategoryId != null
    ? categories.find((category) => category.id === parsedCategoryId)?.id
    : sp.category
      ? categories.find((category) => category.slug === sp.category)?.id
      : undefined;

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
        lang={lang}
        dict={dict}
        initialSearch={sp.q ?? ""}
        initialCategory={initialCategory}
      />
      <AdviceSection advices={advices} lang={lang} dict={dict} />
    </main>
  );
}
