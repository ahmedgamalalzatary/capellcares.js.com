"use client";

import { useMemo, useState } from "react";
import type { Collection, CollectionItem, RelatedItemRef } from "@minikoshk/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { slugifyFormName } from "../../components/forms/form-slug";
import type { CollectionFormProps, CollectionFormRow, UseCollectionFormResult } from "../../types/forms/collection-form.types";

export function useCollectionForm({
  initial,
  products,
  relatedOptions = []
}: CollectionFormProps): UseCollectionFormResult {
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [image, setImage] = useState<string | null>(initial?.imagePath ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [rows, setRows] = useState<CollectionFormRow[]>(() => {
    if (!initial) return [];
    return initial.items.map((item) => {
      const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === item.variantId));
      return { id: item.id, productId: product?.id ?? 0, variantId: item.variantId, qty: item.qty };
    });
  });
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "collection" && option.id === initial?.id)
  );

  const originalTotal = useMemo(() => rows.reduce((sum, row) => {
    const product = products.find((candidate) => candidate.id === row.productId);
    const variant = product?.variants.find((candidate) => candidate.id === row.variantId);
    return sum + (variant?.price ?? 0) * row.qty;
  }, 0), [products, rows]);

  const addRow = () => setRows((state) => [...state, { productId: 0, variantId: 0, qty: 1 }]);

  const removeRow = (index: number) => setRows((state) => state.filter((_, rowIndex) => rowIndex !== index));

  const updateRow = (index: number, patch: Partial<CollectionFormRow>) => {
    setRows((state) => {
      const next = [...state];
      next[index] = { ...next[index], ...patch };
      if (patch.productId != null) {
        next[index].id = undefined;
        next[index].variantId = 0;
      }
      if (patch.variantId != null && patch.variantId !== state[index]?.variantId) {
        next[index].id = undefined;
      }
      return next;
    });
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    const distinctVariantIds = new Set(rows.map((row) => row.variantId).filter(Boolean));

    if (!nameAr.trim()) nextErrors.nameAr = "مطلوب";
    if (!nameEn.trim()) nextErrors.nameEn = "مطلوب";
    if (!categoryId) nextErrors.categoryId = "اختر القسم";
    if (price <= 0) nextErrors.price = "أدخل سعر المجموعة";
    if (!image) nextErrors.image = "أضف صورة";
    const rowsComplete = !rows.some((row) => !row.productId || !row.variantId || row.qty <= 0);
    if (rows.length < 2 || distinctVariantIds.size < 2) {
      nextErrors.rows = "أضف منتجين مختلفين على الأقل";
    } else if (!rowsComplete) {
      nextErrors.rows = "أكمل بيانات كل عنصر";
    } else if (distinctVariantIds.size !== rows.length) {
      nextErrors.rows = "لا يمكن تكرار نفس المقاس داخل المجموعة";
    } else if (rows.some((row) => {
      const product = products.find((candidate) => candidate.id === row.productId);
      return product?.categoryId !== categoryId;
    })) {
      nextErrors.rows = "كل العناصر يجب أن تنتمي إلى نفس القسم المختار";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return false;
    }

    const safeCategoryId = categoryId as number;
    const collection: Omit<Collection, "id"> & { id?: number } = {
      id: initial?.id,
      slug: initial?.slug ?? slugifyFormName(nameEn),
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      description: { ar: descAr, en: descEn },
      imagePath: image ?? "",
      price: Number(price),
      originalTotal,
      categoryId: safeCategoryId,
      items: rows.map((row): CollectionItem => ({ id: row.id, variantId: row.variantId, qty: row.qty })),
      stock: initial?.stock ?? 0,
      status: initial?.status ?? "active",
      visibility: initial?.visibility ?? "visible",
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: initial?.deletedAt ?? null
    };
    if (relatedItems !== undefined) {
      collection.relatedItems = relatedItems;
    }

    try {
      await getStore().upsertCollection(collection);
      return true;
    } catch (error) {
      showErrorToast(error, "تعذر حفظ المجموعة. حاول مرة أخرى.");
      return false;
    }
  };

  return {
    nameAr,
    setNameAr,
    nameEn,
    setNameEn,
    descAr,
    setDescAr,
    descEn,
    setDescEn,
    price,
    setPrice,
    image,
    setImage,
    categoryId,
    setCategoryId: (value) => {
      setCategoryId(value);
      setRows((state) => state.map((row) => {
        const product = products.find((candidate) => candidate.id === row.productId);
        if (!value || product?.categoryId === value) return row;
        return { ...row, id: undefined, productId: 0, variantId: 0 };
      }));
    },
    rows,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    originalTotal,
    addRow,
    removeRow,
    updateRow,
    save
  };
}
