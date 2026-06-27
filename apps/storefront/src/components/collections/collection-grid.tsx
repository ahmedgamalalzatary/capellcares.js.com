"use client";

import { useMemo, useState } from "react";
import { pickLang, type Category, type Collection, type Language } from "@capella/shared";
import { SectionCard } from "@/components/shop/section-card";

function buildCategoryOptions(categories: Category[], lang: Language) {
  const active = categories.filter((category) => !category.deletedAt);
  const childrenByParent = new Map<number | null, Category[]>();
  for (const category of active) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const options: Array<{ id: number; label: string; depth: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const category of childrenByParent.get(parentId) ?? []) {
      options.push({ id: category.id, label: pickLang(category.name, lang), depth });
      visit(category.id, depth + 1);
    }
  };
  visit(null, 0);
  return options;
}

function isInCategoryTree(categories: Category[], categoryId: number, selectedCategoryId: number) {
  let current = categories.find((category) => category.id === categoryId);
  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) return false;
    if (current.id === selectedCategoryId) return true;
    visited.add(current.id);
    current = current.parentId != null
      ? categories.find((category) => category.id === current?.parentId)
      : undefined;
  }
  return false;
}

export function CollectionGrid({
  collections,
  categories,
  lang,
  dict
}: {
  collections: Collection[];
  categories: Category[];
  lang: Language;
  dict: any;
}) {
  const [categoryId, setCategoryId] = useState<number | "">("");
  const categoryOptions = useMemo(() => buildCategoryOptions(categories, lang), [categories, lang]);
  const categoryLabel = dict.collections?.categoryFilterLabel ?? "Collection category";

  const filtered = useMemo(() => {
    return collections.filter((collection) =>
      categoryId === "" || isInCategoryTree(categories, collection.categoryId, categoryId)
    );
  }, [categories, categoryId, collections]);

  if (collections.length === 0) {
    return <p className="py-12 text-center text-(--ink-3)">{dict.collections.listEmpty}</p>;
  }

  return (
    <div className="grid gap-6 pb-16 sm:pb-24">
      <div className="flex flex-wrap items-center justify-start gap-3 border-b border-(--hairline) pb-3.5">
        <select
          className="min-h-10 rounded-md border border-(--hairline-strong) bg-surface px-3 text-sm text-ink"
          aria-label={categoryLabel}
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : "")}
        >
          <option value="">{dict.nav?.allCategories ?? "All categories"}</option>
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {`${"— ".repeat(option.depth)}${option.label}`}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-(--ink-3)">{dict.collections.listEmpty}</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {filtered.map((collection) => (
            <SectionCard key={collection.id} kind="collection" data={collection} lang={lang} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
