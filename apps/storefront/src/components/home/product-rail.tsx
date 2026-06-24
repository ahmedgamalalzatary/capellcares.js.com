import type { Dict, Language, Product } from "@capella/shared";
import { SectionHeading } from "./section-heading";
import { ProductCard } from "./product-card";

/**
 * A titled product section (heading + grid + view-all), matching the ZEE
 * homepage rails ("New Arrivals", "Best Sellers", "Some Inspiration", …).
 */
export function ProductRail({
  top,
  bottom,
  description,
  products,
  lang,
  dict,
  fmt,
  href,
  cta,
  marginTop = 72
}: {
  top: string;
  bottom: string;
  description?: string;
  products: Product[];
  lang: Language;
  dict: Dict;
  fmt: Intl.NumberFormat;
  href?: string;
  cta?: string;
  marginTop?: number;
}) {
  if (products.length === 0) return null;

  return (
    <section className="container" style={{ marginTop }}>
      <SectionHeading top={top} bottom={bottom} description={description} href={href} cta={cta} />
      <div className="grid grid--products">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} lang={lang} dict={dict} fmt={fmt} />
        ))}
      </div>
    </section>
  );
}
