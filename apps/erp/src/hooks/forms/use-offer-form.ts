"use client";

import { useMemo, useState } from "react";
import { resolveLocalizedEntityMediaUrl, type Offer, type OfferItem, type RelatedItemRef } from "@capella/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { getDescendantCategoryIds } from "@/lib/category-tree";
import { slugifyFormName } from "@/lib/slug";
import { useHoverImageFields } from "@/hooks/use-hover-image-fields";
import type { OfferFormProps, OfferFormRow, OfferRequirement, UseOfferFormResult } from "../../types/forms/offer-form.types";

const REQUIREMENT_ERROR: Record<string, string> = {
  nameAr: "أدخلي الاسم بالعربية",
  nameEn: "أدخلي الاسم بالإنجليزية",
  categoryId: "اختاري قسمًا",
  price: "أدخلي سعرًا للعرض",
  rows: "أضيفي عنصرًا صحيحًا واحدًا على الأقل",
  image: "أضيفي صورة العرض"
};

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
    initial?.media ?? (initial?.imagePath
      ? [{ type: "image" as const, arUrl: null, enUrl: initial.imagePath }]
      : [])
  );
  const { arHoverImagePath, setArHoverImagePath, enHoverImagePath, setEnHoverImagePath, hoverImagePayload } = useHoverImageFields(initial);
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
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

  const rowsValid = useMemo(() => {
    if (rows.length === 0) return false;
    if (rows.some((row) => !row.productId || !row.variantId || row.qty <= 0)) return false;
    if (categoryId) {
      const allowed = getDescendantCategoryIds(categories, categoryId);
      return rows.every((row) => {
        const product = products.find((candidate) => candidate.id === row.productId);
        return Boolean(product) && allowed.has(product!.categoryId);
      });
    }
    return true;
  }, [rows, categoryId, products, categories]);

  const requirements: OfferRequirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "الاسم بالإنجليزية", target: "basics", ok: nameEn.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "basics", ok: !!categoryId },
    { key: "price", label: "سعر الباقة", target: "bundle", ok: price > 0 },
    { key: "rows", label: "عناصر الباقة", target: "bundle", ok: rowsValid },
    { key: "image", label: "صورة العرض", target: "media", ok: media.some((item) => item.type === "image") }
  ], [nameAr, nameEn, categoryId, price, rowsValid, media]);

  /** Marks the given requirements' fields as errors when unmet; returns true when all are met. */
  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((requirement) => keys.includes(requirement.key) && !requirement.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const requirement of failing) next[requirement.key] = REQUIREMENT_ERROR[requirement.key] ?? "مطلوب";
      return next;
    });
    return failing.length === 0;
  };

  const missing = requirements.filter((requirement) => !requirement.ok);
  const canPublish = missing.length === 0;

  const validate = (effectiveStatus: Offer["status"]) => {
    const nextErrors: Record<string, string> = {};
    if (effectiveStatus === "active") {
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
    } else if (!nameAr.trim() && !nameEn.trim()) {
      nextErrors.nameAr = "أدخلي اسم العرض بالعربية أو الإنجليزية على الأقل";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /** Saves with the chosen status, or `asStatus` for this save only (e.g. saving a draft from any step). */
  const save = async ({ asStatus }: { asStatus?: Offer["status"] } = {}) => {
    const effectiveStatus = asStatus ?? status;
    if (!validate(effectiveStatus)) {
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
      imagePath: (() => {
        const image = media.find((item) => item.type === "image");
        return image ? resolveLocalizedEntityMediaUrl(image, "en") : "";
      })(),
      ...hoverImagePayload,
      media,
      price: Number(price),
      originalTotal: computed.originalTotal,
      categoryId: categoryId as number,
      stock: initial?.stock ?? 0,
      items,
      status: effectiveStatus,
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
    arHoverImagePath,
    setArHoverImagePath,
    enHoverImagePath,
    setEnHoverImagePath,
    status,
    setStatus,
    categoryId,
    // Changing the category clears any row whose product falls outside the new subtree, so an offer can never keep a member from another category.
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
    save,
    requirements,
    checkRequirements,
    missing,
    canPublish
  };
}
