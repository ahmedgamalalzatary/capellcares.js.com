"use client";

import { useMemo, useState } from "react";
import { resolveLocalizedEntityMediaUrl, type EntityMedia, type RelatedItemRef } from "@capella/shared";
import { moveItem } from "@/lib/array";
import { getDescendantCategoryIds } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { slugifyFormName } from "@/lib/slug";
import { useHoverImageFields } from "@/hooks/use-hover-image-fields";
import type { BundleConfig } from "@/features/bundles/bundle-config";
import type {
  BundleEntity,
  BundleFormProps,
  BundleFormRow,
  BundleRequirement,
  BundleSavePayload,
  UseBundleFormResult
} from "@/features/bundles/types";

/** The one bundle editor hook: offers and collections differ only through their `BundleConfig`. */
export function useBundleForm<TBundle extends BundleEntity>(
  config: BundleConfig,
  { initial, products, categories, relatedOptions = [] }: BundleFormProps<TBundle>
): UseBundleFormResult {
  const { copy, rules } = config;
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl ?? "");
  const [media, setMedia] = useState<EntityMedia[]>(
    initial?.media ?? (initial?.imagePath ? [{ type: "image" as const, arUrl: null, enUrl: initial.imagePath }] : [])
  );
  const { arHoverImagePath, setArHoverImagePath, enHoverImagePath, setEnHoverImagePath, hoverImagePayload } = useHoverImageFields(initial);
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [rows, setRows] = useState<BundleFormRow[]>(() => {
    if (!initial) return [];
    return initial.items.map((item) => {
      const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === item.variantId));
      return { id: item.id, productId: product?.id ?? 0, variantId: item.variantId, qty: item.qty };
    });
  });
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === config.kind && option.id === initial?.id)
  );

  const originalTotal = useMemo(() => rows.reduce((sum, row) => {
    const product = products.find((candidate) => candidate.id === row.productId);
    const variant = product?.variants.find((candidate) => candidate.id === row.variantId);
    return sum + (variant?.price ?? 0) * row.qty;
  }, 0), [products, rows]);

  const addRow = () => setRows((state) => [...state, { productId: 0, variantId: 0, qty: 1 }]);

  const removeRow = (index: number) => setRows((state) => state.filter((_, rowIndex) => rowIndex !== index));

  // Row order is the bundle's product order on the storefront.
  const moveRow = (index: number, direction: -1 | 1) => {
    setRows((state) => moveItem(state, index, direction));
  };

  const updateRow = (index: number, patch: Partial<BundleFormRow>) => {
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
    if (rows.length < rules.minRows) return false;
    if (rows.some((row) => !row.productId || !row.variantId || row.qty <= 0)) return false;
    if (rules.requireDistinctVariants) {
      const distinctVariants = new Set(rows.map((row) => row.variantId).filter(Boolean));
      if (distinctVariants.size < 2 || distinctVariants.size !== rows.length) return false;
    }
    if (categoryId) {
      const allowed = getDescendantCategoryIds(categories, categoryId);
      return rows.every((row) => {
        const product = products.find((candidate) => candidate.id === row.productId);
        return Boolean(product) && allowed.has(product!.categoryId);
      });
    }
    return true;
  }, [rows, categoryId, products, categories, rules]);

  const requirements: BundleRequirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "الاسم بالإنجليزية", target: "basics", ok: nameEn.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "basics", ok: !!categoryId },
    { key: "price", label: copy.requirementLabel.price, target: "bundle", ok: price > 0 },
    { key: "rows", label: copy.requirementLabel.rows, target: "bundle", ok: rowsValid },
    { key: "image", label: copy.requirementLabel.image, target: "media", ok: media.some((item) => item.type === "image") }
  ], [nameAr, nameEn, categoryId, price, rowsValid, media, copy]);

  /** Marks the given requirements' fields as errors when unmet; returns true when all are met. */
  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((requirement) => keys.includes(requirement.key) && !requirement.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const requirement of failing) {
        next[requirement.key] = copy.requirementError[requirement.key as keyof typeof copy.requirementError] ?? "مطلوب";
      }
      return next;
    });
    return failing.length === 0;
  };

  const missing = requirements.filter((requirement) => !requirement.ok);
  const canPublish = missing.length === 0;

  const validate = (effectiveStatus: "active" | "inactive") => {
    const nextErrors: Record<string, string> = {};
    if (effectiveStatus === "active") {
      const distinctVariantIds = new Set(rows.map((row) => row.variantId).filter(Boolean));
      if (!nameAr.trim()) nextErrors.nameAr = "مطلوب";
      if (!nameEn.trim()) nextErrors.nameEn = "مطلوب";
      if (!categoryId) nextErrors.categoryId = "اختاري القسم";
      if (price <= 0) nextErrors.price = copy.validation.price;
      if (!media.some((item) => item.type === "image")) nextErrors.image = "أضيفي صورة";
      const rowsComplete = !rows.some((row) => !row.productId || !row.variantId || row.qty <= 0);
      const rowsOutsideCategory = (categoryId && rows.some((row) => {
        const product = products.find((candidate) => candidate.id === row.productId);
        return !product || !getDescendantCategoryIds(categories, categoryId).has(product.categoryId);
      })) || false;
      if (rules.requireDistinctVariants) {
        if (rows.length < rules.minRows || distinctVariantIds.size < 2) {
          nextErrors.rows = copy.requirementError.rows;
        } else if (!rowsComplete) {
          nextErrors.rows = copy.validation.rowsIncomplete;
        } else if (distinctVariantIds.size !== rows.length) {
          nextErrors.rows = copy.validation.rowsRepeated;
        } else if (rowsOutsideCategory) {
          nextErrors.rows = "كل العناصر يجب أن تنتمي إلى القسم المختار أو أقسامه الفرعية";
        }
      } else if (rows.length === 0) {
        nextErrors.rows = copy.validation.rowsEmpty;
      } else if (!rowsComplete) {
        nextErrors.rows = copy.validation.rowsIncomplete;
      } else if (rowsOutsideCategory) {
        nextErrors.rows = "كل العناصر يجب أن تنتمي إلى القسم المختار أو أقسامه الفرعية";
      }
    } else if (!nameAr.trim() && !nameEn.trim()) {
      nextErrors.nameAr = copy.validation.draftName;
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /** Saves with the chosen status, or `asStatus` for this save only (e.g. saving a draft from any step). */
  const save = async ({ asStatus }: { asStatus?: "active" | "inactive" } = {}) => {
    const effectiveStatus = asStatus ?? status;
    if (!validate(effectiveStatus)) {
      return false;
    }
    const image = media.find((item) => item.type === "image");
    const bundle: BundleSavePayload = {
      id: initial?.id,
      slug: initial?.slug ?? slugifyFormName(nameEn),
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      description: { ar: descAr, en: descEn },
      youtubeUrl: youtubeUrl.trim() || undefined,
      imagePath: image ? resolveLocalizedEntityMediaUrl(image, "en") : "",
      ...hoverImagePayload,
      media,
      price: Number(price),
      originalTotal,
      categoryId: categoryId as number,
      stock: initial?.stock ?? 0,
      items: rows.map((row) => ({ id: row.id, variantId: row.variantId, qty: row.qty })),
      status: effectiveStatus,
      visibility: initial?.visibility ?? "visible",
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: initial?.deletedAt ?? null
    };
    if (relatedItems !== undefined) {
      bundle.relatedItems = relatedItems;
    }

    try {
      await config.upsert(bundle);
      return true;
    } catch (error) {
      showErrorToast(error, config.copy.saveError);
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
    originalTotal,
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
