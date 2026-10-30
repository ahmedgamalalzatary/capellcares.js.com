"use client";

import Link from "next/link";
import { pickLang, type Language, type Product } from "@capella/shared";
import { useProductAttributes } from "@/components/providers/product-attributes-provider";

const CHIP = "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold";
const LINK_CHIP = `${CHIP} bg-(--warm-soft) text-(--violet-deep) transition-colors hover:bg-(--accent-soft)`;

/** The brand, ages and characters on the product page. */
export function ProductAttributeLinks({ product, lang, dict }: { product: Product; lang: Language; dict: any }) {
  const { brands, characters, ageGroups } = useProductAttributes();
  const brand = brands.find((item) => item.id === product.brandId);
  const ages = ageGroups.filter((item) => product.ageGroupIds?.includes(item.id));
  const productCharacters = characters.filter((item) => product.characterIds?.includes(item.id));

  if (!brand && ages.length === 0 && productCharacters.length === 0) return null;

  return (
    <dl className="m-0 [display:grid] grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
      {brand ? (
        <>
          <dt className="font-bold text-(--ink-2)">{dict.filters.brand}</dt>
          <dd className="m-0 flex flex-wrap gap-2">
            <Link href={`/${lang}/brands/${brand.slug}`} className={LINK_CHIP}>{pickLang(brand.name, lang)}</Link>
          </dd>
        </>
      ) : null}
      {ages.length > 0 ? (
        <>
          <dt className="font-bold text-(--ink-2)">{dict.filters.age}</dt>
          <dd className="m-0 flex flex-wrap gap-2">
            {ages.map((item) => (
              <span key={item.id} className={`${CHIP} bg-(--sunny) text-ink`}>{pickLang(item.name, lang)}</span>
            ))}
          </dd>
        </>
      ) : null}
      {productCharacters.length > 0 ? (
        <>
          <dt className="font-bold text-(--ink-2)">{dict.filters.character}</dt>
          <dd className="m-0 flex flex-wrap gap-2">
            {productCharacters.map((item) => (
              <Link key={item.id} href={`/${lang}/characters/${item.slug}`} className={LINK_CHIP}>{pickLang(item.name, lang)}</Link>
            ))}
          </dd>
        </>
      ) : null}
    </dl>
  );
}
