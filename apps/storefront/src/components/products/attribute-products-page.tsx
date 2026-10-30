import Image from "next/image";
import { getDict, pickLang, type Language, type Product, type ProductAttribute } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CategoryComingSoon } from "@/components/products/category-coming-soon";
import { ProductGrid } from "@/components/products/grid/product-grid";
import { fetchCategories, fetchProducts } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";

/** A brand's or character's own page: its picture and name above its products. */
export async function AttributeProductsPage({
  item,
  lang,
  kind,
  matches
}: {
  item: ProductAttribute;
  lang: Language;
  kind: "brand" | "character";
  matches: (product: Product) => boolean;
}) {
  const dict = getDict(lang);
  const [categories, products] = await Promise.all([fetchCategories({ lang }), fetchProducts({ lang })]);
  const name = pickLang(item.name, lang);
  const imagePath = item.imagePath ? resolveMediaUrl(item.imagePath) : "";

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}/shop` },
          { label: dict.nav.products, href: `/${lang}/products` },
          { label: name }
        ]}
      />
      <header className="page-head flex! items-center gap-5">
        {imagePath ? (
          <span className={`relative size-20 shrink-0 overflow-hidden bg-surface shadow-[inset_0_0_0_3px_var(--accent-soft)] sm:size-28 ${kind === "character" ? "rounded-full" : "rounded-3xl"}`}>
            <Image src={imagePath} alt="" fill sizes="112px" className={kind === "character" ? "object-cover" : "object-contain p-2"} />
          </span>
        ) : null}
        <h1>{name}</h1>
      </header>
      {item.hasProducts === false ? (
        <CategoryComingSoon lang={lang} dict={dict} />
      ) : (
        <ProductGrid
          products={products.filter((product) => product.status === "active" && matches(product))}
          categories={categories.filter((category) => !category.deletedAt)}
          lang={lang}
          dict={dict}
          hiddenAttributeFilters={[kind]}
        />
      )}
    </main>
  );
}
