import Link from "next/link";
import type { Dict, Language, Product } from "@capella/shared";
import { ProductIllustration } from "@/components/ui/product-illustration";

function productPrice(product: Product): number {
  const prices = product.variants?.map((v) => v.price).filter((p) => p > 0) ?? [];
  return prices.length ? Math.min(...prices) : 0;
}

/** Single ZEE-style product card, reused across every shop rail. */
export function ProductCard({
  product,
  lang,
  dict,
  fmt
}: {
  product: Product;
  lang: Language;
  dict: Dict;
  fmt: Intl.NumberFormat;
}) {
  const price = productPrice(product);
  return (
    <Link href={`/${lang}/products/${product.slug}`} className="pcard">
      <div className="pcard__badges">
        {product.isNew && <span className="badge badge--new">{dict.badges.new}</span>}
        {product.isBestseller && <span className="badge badge--gold">{dict.badges.bestseller}</span>}
      </div>
      <div className="pcard__img">
        <ProductIllustration product={product} />
      </div>
      <div className="pcard__body">
        <span className="pcard__name">{product.name[lang] ?? product.name.en}</span>
        <span className="pcard__price">
          {price > 0 ? `${dict.common.from} ${fmt.format(price)}` : "—"}
        </span>
      </div>
    </Link>
  );
}
