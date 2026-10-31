"use client";

import { pickLang, type Language, type Product } from "@capella/shared";
import { useProductAttributes } from "@/components/providers/product-attributes-provider";

const CHIP = "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold";

/** The ages on the product page. */
export function ProductAttributeLinks({ product, lang, dict }: { product: Product; lang: Language; dict: any }) {
  const { ageGroups } = useProductAttributes();
  const ages = ageGroups.filter((item) => product.ageGroupIds?.includes(item.id));

  if (ages.length === 0) return null;

  return (
    <dl className="m-0 [display:grid] grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
      <dt className="font-bold text-(--ink-2)">{dict.filters.age}</dt>
      <dd className="m-0 flex flex-wrap gap-2">
        {ages.map((item) => (
          <span key={item.id} className={`${CHIP} bg-(--sunny) text-ink`}>{pickLang(item.name, lang)}</span>
        ))}
      </dd>
    </dl>
  );
}
