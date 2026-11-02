"use client";

import { useMemo, useState } from "react";
import { resolveLocalizedEntityMediaUrl, type Product, type ProductColor, type RelatedItemRef } from "@capella/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { slugifyFormName } from "@/lib/slug";
import { useHoverImageFields } from "@/hooks/use-hover-image-fields";
import type { ProductFormErrors, ProductFormProps, Requirement } from "@/features/products/types";
import {
  cellKey,
  emptySize,
  matrixFromVariants,
  matrixProblem,
  newTempId,
  variantsFromMatrix,
  type MatrixProblem,
  type SizeRow,
  type VariantMatrix
} from "@/features/products/lib/variant-matrix";

const REQUIREMENT_ERROR: Record<string, string> = {
  nameAr: "أدخلي الاسم بالعربية",
  nameEn: "أدخلي الاسم بالإنجليزية",
  buyingPrice: "أدخلي سعر شراء أكبر من صفر",
  keywords: "أضيفي كلمات مفتاحية",
  categoryId: "اختاري قسمًا",
  supplierId: "اختاري المورد",
  image: "أضيفي صورة المنتج",
  variants: "أدخلي سعرًا أكبر من صفر لكل مقاس"
};

const MATRIX_ERROR: Record<MatrixProblem, string> = {
  price: "أدخلي سعرًا أكبر من صفر لكل مقاس",
  "size-name": "اكتبي اسم كل مقاس، أو احذفي المقاسات الزائدة إن لم يكن للمنتج مقاسات",
  "size-repeat": "يوجد مقاس مكرر. اجعلي لكل مقاس اسمًا مختلفًا",
  color: "اختاري لونًا من اللوحة أو اكتبي اسمه لكل لون"
};

/** Re-keys every stock cell and stored variant id of one colour column (null = no colour) to another, so the first colour added keeps the existing stock. */
function moveColumn(matrix: VariantMatrix, from: number | null, to: number | null): VariantMatrix {
  const stock = { ...matrix.stock };
  const variantIds = { ...matrix.variantIds };
  for (const size of matrix.sizes) {
    const oldKey = cellKey(size.key, from);
    const newKey = cellKey(size.key, to);
    if (oldKey in stock) { stock[newKey] = stock[oldKey]!; delete stock[oldKey]; }
    if (oldKey in variantIds) { variantIds[newKey] = variantIds[oldKey]!; delete variantIds[oldKey]; }
  }
  return { ...matrix, stock, variantIds };
}

export function useProductForm({
  initial,
  relatedOptions = []
}: Pick<ProductFormProps, "initial" | "relatedOptions">) {
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [ingAr, setIngAr] = useState(initial?.ingredients.ar ?? "");
  const [ingEn, setIngEn] = useState(initial?.ingredients.en ?? "");
  const [useAr, setUseAr] = useState(initial?.howToUse.ar ?? "");
  const [useEn, setUseEn] = useState(initial?.howToUse.en ?? "");
  const [warnAr, setWarnAr] = useState(initial?.warnings.ar ?? "");
  const [warnEn, setWarnEn] = useState(initial?.warnings.en ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [buyingPrice, setBuyingPrice] = useState(initial?.buyingPrice ?? 0);
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [brandId, setBrandId] = useState<number | null>(initial?.brandId ?? null);
  const [supplierId, setSupplierId] = useState<number | null>(initial?.supplierId ?? null);
  const [ageGroupIds, setAgeGroupIds] = useState<number[]>(initial?.ageGroupIds ?? []);
  const [genderIds, setGenderIds] = useState<number[]>(initial?.genderIds ?? []);
  const [media, setMedia] = useState(
    initial?.media ?? (initial?.imagePath
      ? [{ type: "image" as const, arUrl: null, enUrl: initial.imagePath }]
      : [])
  );
  const { arHoverImagePath, setArHoverImagePath, enHoverImagePath, setEnHoverImagePath, hoverImagePayload } = useHoverImageFields(initial);
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [isBestseller, setIsBestseller] = useState(initial?.isBestseller ?? false);
  const [matrix, setMatrix] = useState<VariantMatrix>(() => matrixFromVariants(initial?.variants ?? []));
  const [colors, setColors] = useState<ProductColor[]>(initial?.colors ?? []);
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<ProductFormErrors>({});

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "product" && option.id === initial?.id)
  );

  const sizes = matrix.sizes;

  const addSize = () => setMatrix((m) => ({ ...m, sizes: [...m.sizes, emptySize()] }));

  const updateSize = (key: number, patch: Partial<Omit<SizeRow, "key">>) => {
    setMatrix((m) => ({ ...m, sizes: m.sizes.map((size) => size.key === key ? { ...size, ...patch } : size) }));
  };

  const removeSize = (key: number) => {
    setMatrix((m) => m.sizes.length === 1 ? m : { ...m, sizes: m.sizes.filter((size) => size.key !== key) });
  };

  const stockOf = (sizeKey: number, colorId: number | null) => matrix.stock[cellKey(sizeKey, colorId)] ?? 0;

  const setStock = (sizeKey: number, colorId: number | null, value: number) => {
    setMatrix((m) => ({ ...m, stock: { ...m.stock, [cellKey(sizeKey, colorId)]: value } }));
  };

  const addColor = () => {
    const color: ProductColor = { id: newTempId(), name: { ar: "", en: "" }, hex: null, media: [] };
    // The first colour takes over the colourless stock, so adding colours to a live product keeps its counts.
    if (colors.length === 0) setMatrix((m) => moveColumn(m, null, color.id));
    setColors((cs) => [...cs, color]);
  };

  const updateColor = (id: number, patch: Partial<Omit<ProductColor, "id">>) => {
    setColors((cs) => cs.map((color) => color.id === id ? { ...color, ...patch } : color));
  };

  const removeColor = (id: number) => {
    if (colors.length === 1 && colors[0]!.id === id) setMatrix((m) => moveColumn(m, id, null));
    setColors((cs) => cs.filter((color) => color.id !== id));
  };

  const hasImage = media.some((item) => item.type === "image")
    || colors.some((color) => color.media.some((item) => item.type === "image"));
  const variantsProblem = matrixProblem(sizes, colors);

  const requirements: Requirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "الاسم بالإنجليزية", target: "basics", ok: nameEn.trim().length > 0 },
    { key: "buyingPrice", label: "سعر الشراء", target: "pricing", ok: !!buyingPrice && buyingPrice > 0 },
    { key: "keywords", label: "كلمات مفتاحية", target: "basics", ok: keywords.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "basics", ok: !!categoryId },
    { key: "supplierId", label: "المورد", target: "basics", ok: !!supplierId },
    { key: "image", label: "صورة المنتج", target: "media", ok: hasImage },
    { key: "variants", label: "المقاسات والألوان", target: "pricing", ok: variantsProblem === null }
  ], [nameAr, nameEn, buyingPrice, keywords, categoryId, supplierId, hasImage, variantsProblem]);

  /** Marks the given requirements' fields as errors when unmet; returns true when all are met. */
  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((r) => keys.includes(r.key) && !r.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const r of failing) {
        next[r.key] = r.key === "variants" && variantsProblem ? MATRIX_ERROR[variantsProblem] : REQUIREMENT_ERROR[r.key] ?? "مطلوب";
      }
      return next;
    });
    return failing.length === 0;
  };

  const completedCount = requirements.filter((r) => r.ok).length;
  const totalCount = requirements.length;
  const missing = requirements.filter((r) => !r.ok);
  const canActivate = missing.length === 0;
  const validate = (effectiveStatus: Product["status"]) => {
    const next: ProductFormErrors = {};
    if (effectiveStatus === "active") {
      if (!nameAr.trim()) next.nameAr = "مطلوب لتفعيل المنتج";
      if (!nameEn.trim()) next.nameEn = "مطلوب لتفعيل المنتج";
      if (!buyingPrice || buyingPrice <= 0) next.buyingPrice = "أدخلي سعر شراء أكبر من صفر";
      if (!categoryId) next.categoryId = "اختاري قسمًا";
      if (!supplierId) next.supplierId = REQUIREMENT_ERROR.supplierId;
      if (!keywords.trim()) next.keywords = "أضيفي كلمات مفتاحية";
      if (!hasImage) next.image = "أضيفي صورة المنتج";
    } else if (!nameAr.trim() && !nameEn.trim()) {
      next.nameAr = "أدخلي اسم المنتج بالعربية أو الإنجليزية على الأقل";
    }
    // Sizes and colours must be consistent even for a draft: the server refuses repeats and blank colours.
    if (variantsProblem && (effectiveStatus === "active" || variantsProblem !== "price")) next.variants = MATRIX_ERROR[variantsProblem];
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildProduct = (effectiveStatus: Product["status"]): Product => {
    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn);
    const primaryMedia = media.find((item) => item.type === "image");
    const primaryImage = primaryMedia ? resolveLocalizedEntityMediaUrl(primaryMedia, "en") : "";
    const product: Product = {
      id: id ?? 0,
      sku: sku.trim() || `SKU-${Date.now()}`,
      slug,
      name: { ar: nameAr, en: nameEn },
      description: { ar: descAr, en: descEn },
      ingredients: { ar: ingAr, en: ingEn },
      howToUse: { ar: useAr, en: useEn },
      warnings: { ar: warnAr, en: warnEn },
      // The field is a textarea, so Enter is as natural a separator as a comma.
      keywords: keywords.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean),
      buyingPrice: Number(buyingPrice) || 0,
      imagePath: primaryImage,
      ...hoverImagePayload,
      media,
      colors: colors.map((color) => ({
        ...color,
        name: { ar: color.name.ar.trim(), en: color.name.en.trim() }
      })),
      youtubeUrl: youtubeUrl.trim() || undefined,
      status: effectiveStatus,
      isNew,
      isBestseller,
      categoryId: categoryId ?? 0,
      brandId,
      supplierId,
      ageGroupIds,
      genderIds,
      variants: variantsFromMatrix(matrix, colors, id ?? 0),
      offerIds: initial?.offerIds ?? [],
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    if (relatedItems !== undefined) {
      product.relatedItems = relatedItems;
    }
    return product;
  };

  /** Saves with the chosen status, or `asStatus` for this save only (e.g. saving a draft from any step). */
  const save = async ({ asStatus }: { asStatus?: Product["status"] } = {}) => {
    const effectiveStatus = asStatus ?? status;
    if (!validate(effectiveStatus)) return false;
    try {
      await getStore().upsertProduct(buildProduct(effectiveStatus));
      return true;
    } catch (error) {
      showErrorToast(error, "تعذر حفظ المنتج. حاولي مرة أخرى.");
      return false;
    }
  };

  return {
    nameAr, setNameAr,
    nameEn, setNameEn,
    descAr, setDescAr,
    descEn, setDescEn,
    ingAr, setIngAr,
    ingEn, setIngEn,
    useAr, setUseAr,
    useEn, setUseEn,
    warnAr, setWarnAr,
    warnEn, setWarnEn,
    sku, setSku,
    buyingPrice, setBuyingPrice,
    keywords, setKeywords,
    youtubeUrl, setYoutubeUrl,
    categoryId, setCategoryId,
    brandId, setBrandId,
    supplierId, setSupplierId,
    ageGroupIds, setAgeGroupIds,
    genderIds, setGenderIds,
    media, setMedia,
    arHoverImagePath, setArHoverImagePath,
    enHoverImagePath, setEnHoverImagePath,
    status, setStatus,
    isNew, setIsNew,
    isBestseller, setIsBestseller,
    sizes,
    addSize,
    updateSize,
    removeSize,
    stockOf,
    setStock,
    colors,
    addColor,
    updateColor,
    removeColor,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    requirements,
    checkRequirements,
    completedCount,
    totalCount,
    missing,
    canActivate,
    save
  };
}
