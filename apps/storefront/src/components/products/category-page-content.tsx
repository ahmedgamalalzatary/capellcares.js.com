"use client";

import { useState } from "react";
import { pickLang, type Category, type Language, type Product } from "@capella/shared";

import { ProductGrid } from "./grid/product-grid";

export function CategoryPageContent({
  category,
  subCats,
  products,
  categories,
  lang,
  dict
}: {
  category: Category;
  subCats: Category[];
  products: Product[];
  categories: Category[];
  lang: Language;
  dict: any;
}) {
  const [headerCategoryIds, setHeaderCategoryIds] = useState<number[]>([]);

  const toggleHeaderCategory = (categoryId: number) => {
    setHeaderCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  return (
    <>
      {subCats.length > 0 && (
        <div className="pill-group" style={{ marginTop: 12 }}>
          {subCats.map((item) => {
            const active = headerCategoryIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "filter-pill filter-pill--active" : "filter-pill"}
                aria-pressed={active}
                onClick={() => toggleHeaderCategory(item.id)}
              >
                {pickLang(item.name, lang)}
              </button>
            );
          })}
        </div>
      )}
      <ProductGrid
        products={products}
        categories={categories}
        lang={lang}
        dict={dict}
        initialCategory={category.id}
        lockCategory={false}
        headerCategoryIds={headerCategoryIds}
        onHeaderCategoryIdsChange={setHeaderCategoryIds}
      />
    </>
  );
}
