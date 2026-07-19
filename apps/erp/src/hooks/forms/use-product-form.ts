"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductVariant, RelatedItemRef } from "@minikoshk/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { slugifyFormName } from "../../components/forms/form-slug";
import type { ProductFormErrors, ProductFormProps, Requirement } from "../../types/forms/product-form.types";
import {
  buildVariantMatrix,
  type ProductColorOption,
  type ProductSizeOption
} from "./product-variant-matrix";
import { validateProductOptionValues } from "./product-option-validation";

// Negative, monotonically-decreasing temp ids never collide with positive DB autoincrement ids.
let tempIdCounter = 0;
function newTempId() {
  tempIdCounter -= 1;
  return tempIdCounter;
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
  const [media, setMedia] = useState(
    initial?.media ?? (initial?.imagePath ? [{ type: "image" as const, url: initial.imagePath }] : [])
  );
  const [hoverImagePath, setHoverImagePath] = useState(initial?.hoverImagePath ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [isBestseller, setIsBestseller] = useState(initial?.isBestseller ?? false);
  const [sizes, setSizes] = useState<ProductSizeOption[]>(
    initial?.sizes?.map((size) => ({ id: size.id, label: size.label })) ?? [{ id: newTempId(), label: "" }]
  );
  const [colors, setColors] = useState<ProductColorOption[]>(
    initial?.colors?.map((color) => ({ id: color.id, hex: color.hex })) ?? []
  );
  const [variants, setVariants] = useState<ProductVariant[]>(
    () => buildVariantMatrix(
      initial?.sizes?.map((size) => ({ id: size.id, label: size.label })) ?? [{ id: sizes[0]!.id, label: "" }],
      initial?.colors?.map((color) => ({ id: color.id, hex: color.hex })) ?? [],
      initial?.variants ?? [],
      newTempId
    )
  );
  const variantsRef = useRef(variants);
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const optionValidationError = validateProductOptionValues(sizes, colors);

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "product" && option.id === initial?.id)
  );

  const updateVariant = (id: number, patch: Partial<ProductVariant>) => {
    setVariants((current) =>
      current.map((variant) => variant.id === id ? { ...variant, ...patch } : variant)
    );
  };

  useEffect(() => {
    variantsRef.current = variants;
  }, [variants]);

  useEffect(() => {
    const next = buildVariantMatrix(sizes, colors, variantsRef.current, newTempId);
    variantsRef.current = next;
    setVariants(next);
  }, [sizes, colors]);

  const updateSize = (id: number, label: string) => {
    setSizes((current) => current.map((size) => size.id === id ? { ...size, label } : size));
  };

  const addSize = () => {
    const size = { id: newTempId(), label: "" };
    setSizes((current) => [...current, size]);
  };

  const removeSize = (id: number) => {
    setSizes((current) => current.length === 1 ? current : current.filter((size) => size.id !== id));
  };

  const addColor = () => {
    const color = { id: newTempId(), hex: "#000000" };
    setColors((current) => [...current, color]);
  };

  const updateColor = (id: number, hex: string) => {
    setColors((current) => current.map((color) => color.id === id ? { ...color, hex: hex.toUpperCase() } : color));
  };

  const removeColor = (id: number) => {
    setColors((current) => current.filter((color) => color.id !== id));
  };

  const requirements: Requirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "section-basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "Name (EN)", target: "section-basics", ok: nameEn.trim().length > 0 },
    { key: "buyingPrice", label: "سعر الشراء", target: "section-basics", ok: !!buyingPrice && buyingPrice > 0 },
    { key: "keywords", label: "كلمات مفتاحية", target: "section-basics", ok: keywords.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "section-publish", ok: !!categoryId },
    { key: "image", label: "صورة المنتج", target: "section-media", ok: media.some((item) => item.type === "image") },
    { key: "variants", label: "المقاسات والأسعار", target: "section-variants", ok: sizes.length > 0 && !optionValidationError && variants.length > 0 && variants.every((v) => v.price > 0) }
  ], [nameAr, nameEn, buyingPrice, keywords, categoryId, media, sizes, variants, optionValidationError]);

  const completedCount = requirements.filter((r) => r.ok).length;
  const totalCount = requirements.length;
  const missing = requirements.filter((r) => !r.ok);
  const canActivate = missing.length === 0;
  const wantActive = status === "active";

  const validate = () => {
    const next: ProductFormErrors = {};
    if (optionValidationError === "duplicate-size") next.variants = "لا يمكن تكرار نفس المقاس";
    if (optionValidationError === "duplicate-color") next.variants = "لا يمكن تكرار نفس اللون";
    if (wantActive) {
      if (optionValidationError === "blank-size") next.variants = "أدخل قيمة لكل مقاس";
      if (!nameAr.trim()) next.nameAr = "مطلوب لتفعيل المنتج";
      if (!nameEn.trim()) next.nameEn = "مطلوب لتفعيل المنتج";
      if (!buyingPrice || buyingPrice <= 0) next.buyingPrice = "أدخل سعر شراء أكبر من صفر";
      if (!next.variants && (sizes.length === 0 || variants.length === 0 || variants.some((v) => v.price <= 0))) next.variants = "أضف المقاسات وأدخل سعرًا صحيحًا لكل تركيبة";
      if (!categoryId) next.categoryId = "اختر قسمًا";
      if (!keywords.trim()) next.keywords = "أضف كلمات مفتاحية";
      if (!media.some((item) => item.type === "image")) next.image = "أضف صورة المنتج";
    } else if (!nameAr.trim() && !nameEn.trim()) {
      next.nameAr = "أدخل اسم المنتج بالعربية أو الإنجليزية على الأقل";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildProduct = (): Product => {
    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn || nameAr || "product");
    const primaryImage = media.find((item) => item.type === "image")?.url ?? "";
    const validSizeIds = new Set(sizes.filter((size) => size.label.trim()).map((size) => size.id));
    const product: Product = {
      id: id ?? 0,
      sku: sku.trim() || `SKU-${Date.now()}`,
      slug,
      name: { ar: nameAr, en: nameEn },
      description: { ar: descAr, en: descEn },
      ingredients: { ar: ingAr, en: ingEn },
      howToUse: { ar: useAr, en: useEn },
      warnings: { ar: warnAr, en: warnEn },
      keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
      buyingPrice: Number(buyingPrice) || 0,
      imagePath: primaryImage,
      hoverImagePath,
      media,
      youtubeUrl: youtubeUrl.trim() || undefined,
      status,
      isNew,
      isBestseller,
      categoryId: categoryId ?? 0,
      sizes: sizes.filter((size) => validSizeIds.has(size.id)).map((size, index) => ({
        ...size,
        productId: id ?? 0,
        label: size.label.trim().replace(/\s+/g, " "),
        sortOrder: index + 1
      })),
      colors: colors.map((color, index) => ({
        ...color,
        productId: id ?? 0,
        hex: color.hex.toUpperCase(),
        sortOrder: index + 1
      })),
      variants: variants.filter((variant) => validSizeIds.has(variant.sizeId)).map((v, i) => ({
        ...v,
        productId: id ?? 0,
        sortOrder: i + 1,
        stock: Math.max(0, v.stock),
        price: Math.max(0, v.price)
      })),
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

  const save = async () => {
    if (!validate()) return false;
    try {
      await getStore().upsertProduct(buildProduct());
      return true;
    } catch (error) {
      showErrorToast(error, "تعذر حفظ المنتج. حاول مرة أخرى.");
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
    media, setMedia,
    hoverImagePath, setHoverImagePath,
    status, setStatus,
    isNew, setIsNew,
    isBestseller, setIsBestseller,
    sizes,
    colors,
    variants,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    updateVariant,
    updateSize,
    addSize,
    removeSize,
    updateColor,
    addColor,
    removeColor,
    requirements,
    completedCount,
    totalCount,
    missing,
    canActivate,
    save
  };
}
