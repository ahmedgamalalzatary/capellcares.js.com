"use client";

import { useMemo, useState } from "react";
import type { Offer, OfferItem, RelatedItemRef } from "@capella/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { getDescendantCategoryIds } from "@/lib/category-tree";
import { slugifyFormName } from "../../components/forms/form-slug";
import type { OfferFormProps, OfferFormRow, UseOfferFormResult } from "../../types/forms/offer-form.types";

export function useOfferForm({
  initial,
  products,
  categories,
  relatedOptions = []
}: OfferFormProps): UseOfferFormResult {
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl ?? "");
  const [media, setMedia] = useState(
    initial?.media ?? (initial?.imagePath ? [{ type: "image" as const, url: initial.imagePath }] : [])
  );
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [rows, setRows] = useState<OfferFormRow[]>(() => {
    if (!initial) {
      return [];
    }
    return initial.items.map((item) => {
      const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === item.variantId));
      return { id: item.id, productId: product?.id ?? 0, variantId: item.variantId, qty: item.qty };
    });
  });
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "offer" && option.id === initial?.id)
  );

  const computed = useMemo(() => {
    let originalTotal = 0;
    const breakdown = rows.map((row) => {
      const product = products.find((candidate) => candidate.id === row.productId);
      const variant = product?.variants.find((candidate) => candidate.id === row.variantId);
      const subtotal = (variant?.price ?? 0) * row.qty;
      originalTotal += subtotal;
      return { product, variant, subtotal, row };
    });
    return { originalTotal, breakdown };
  }, [products, rows]);

  const addRow = () => setRows((state) => [...state, { productId: 0, variantId: 0, qty: 1 }]);

  const removeRow = (index: number) => setRows((state) => state.filter((_, rowIndex) => rowIndex !== index));

  // Row order is the offer's product order on the storefront.
  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((state) => {
      const nextIndex = index + direction;
      if (index < 0 || index >= state.length || nextIndex < 0 || nextIndex >= state.length) {
        return state;
      }
      const next = [...state];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  };

  const updateRow = (index: number, patch: Partial<OfferFormRow>) => {
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
    if (!nameAr.trim()) nextErrors.nameAr = "مطلوب";
    if (!nameEn.trim()) nextErrors.nameEn = "مطلوب";
    if (!categoryId) nextErrors.categoryId = "اختاري القسم";
    if (price <= 0) nextErrors.price = "أدخلي سعرًا للعرض";
    if (!media.some((item) => item.type === "image")) nextErrors.image = "أضيفي صورة";
    if (rows.length === 0) {
      nextErrors.rows = "أضيفي منتجًا واحدًا على الأقل";
    } else if (rows.some((row) => !row.productId || !row.variantId || row.qty <= 0)) {
      nextErrors.rows = "أكملي بيانات كل عنصر";
    } else if (categoryId && rows.some((row) => {
      const product = products.find((candidate) => candidate.id === row.productId);
      return !product || !getDescendantCategoryIds(categories, categoryId).has(product.categoryId);
    })) {
      nextErrors.rows = "كل العناصر يجب أن تنتمي إلى القسم المختار أو أقسامه الفرعية";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return false;
    }

    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn);
    const items: OfferItem[] = rows.map((row) => ({ id: row.id, variantId: row.variantId, qty: row.qty }));
    const offer: Omit<Offer, "id"> & { id?: number } = {
      id,
      slug,
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      description: { ar: descAr, en: descEn },
      youtubeUrl: youtubeUrl.trim() || undefined,
      imagePath: media.find((item) => item.type === "image")?.url ?? "",
      media,
      price: Number(price),
      originalTotal: computed.originalTotal,
      categoryId: categoryId as number,
      stock: initial?.stock ?? 0,
      items,
      status: initial?.status ?? "active",
      visibility: initial?.visibility ?? "visible",
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    if (relatedItems !== undefined) {
      offer.relatedItems = relatedItems;
    }
    try {
      await getStore().upsertOffer(offer);
      return true;
    } catch (error) {
      showErrorToast(error, "تعذر حفظ العرض. حاولي مرة أخرى.");
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
    youtubeUrl,
    setYoutubeUrl,
    media,
    setMedia,
    categoryId,
    // Changing the category clears any row whose product falls outside the new
    // subtree, so an offer can never keep a member from another category.
    setCategoryId: (value) => {
      setCategoryId(value);
      const allowedCategoryIds = value != null ? getDescendantCategoryIds(categories, value) : null;
      setRows((state) => state.map((row) => {
        const product = products.find((candidate) => candidate.id === row.productId);
        if (!value || !product || allowedCategoryIds?.has(product.categoryId)) return row;
        return { ...row, id: undefined, productId: 0, variantId: 0 };
      }));
    },
    rows,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    computed,
    addRow,
    removeRow,
    moveRow,
    updateRow,
    save
  };
}
