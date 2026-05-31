"use client";

import { useMemo, useState } from "react";
import type { Product, ProductVariant, RelatedItemRef } from "@capella/shared";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import { slugifyFormName } from "../../components/forms/form-slug";
import type { ProductFormErrors, ProductFormProps, Requirement } from "../../types/forms/product-form.types";

// Negative, monotonically-decreasing temp ids never collide with positive DB autoincrement ids.
let tempVariantIdCounter = 0;
function newVariantId() {
  tempVariantIdCounter -= 1;
  return tempVariantIdCounter;
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
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants ?? [{ id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]
  );
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<ProductFormErrors>({});

  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "product" && option.id === initial?.id)
  );

  const updateVariant = (id: number, patch: Partial<ProductVariant>) => {
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
  };

  const addVariant = () => {
    setVariants((vs) => [...vs, { id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]);
  };

  const removeVariant = (id: number) => {
    setVariants((vs) => vs.length === 1 ? vs : vs.filter((v) => v.id !== id));
  };

  const requirements: Requirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "section-basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "Name (EN)", target: "section-basics", ok: nameEn.trim().length > 0 },
    { key: "buyingPrice", label: "سعر الشراء", target: "section-basics", ok: !!buyingPrice && buyingPrice > 0 },
    { key: "keywords", label: "كلمات مفتاحية", target: "section-basics", ok: keywords.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "section-publish", ok: !!categoryId },
    { key: "image", label: "صورة المنتج", target: "section-media", ok: media.some((item) => item.type === "image") },
    { key: "variants", label: "مقاس وسعر", target: "section-variants", ok: variants.length > 0 && variants.every((v) => v.size.trim() && v.price > 0) }
  ], [nameAr, nameEn, buyingPrice, keywords, categoryId, media, variants]);

  const completedCount = requirements.filter((r) => r.ok).length;
  const totalCount = requirements.length;
  const missing = requirements.filter((r) => !r.ok);
  const canActivate = missing.length === 0;
  const wantActive = status === "active";

  const validate = () => {
    const next: ProductFormErrors = {};
    if (wantActive) {
      if (!nameAr.trim()) next.nameAr = "مطلوب لتفعيل المنتج";
      if (!nameEn.trim()) next.nameEn = "مطلوب لتفعيل المنتج";
      if (!buyingPrice || buyingPrice <= 0) next.buyingPrice = "أدخلي سعر شراء أكبر من صفر";
      if (variants.length === 0 || variants.some((v) => !v.size.trim() || v.price <= 0)) next.variants = "أضيفي مقاسًا واحدًا على الأقل مع سعر صحيح";
      if (!categoryId) next.categoryId = "اختاري قسمًا";
      if (!keywords.trim()) next.keywords = "أضيفي كلمات مفتاحية";
      if (!media.some((item) => item.type === "image")) next.image = "أضيفي صورة المنتج";
    } else if (!nameAr.trim() && !nameEn.trim()) {
      next.nameAr = "أدخلي اسم المنتج بالعربية أو الإنجليزية على الأقل";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildProduct = (): Product => {
    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn || nameAr || "product");
    const primaryImage = media.find((item) => item.type === "image")?.url ?? "";
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
      variants: variants.map((v, i) => ({
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
    media, setMedia,
    hoverImagePath, setHoverImagePath,
    status, setStatus,
    isNew, setIsNew,
    isBestseller, setIsBestseller,
    variants,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    updateVariant,
    addVariant,
    removeVariant,
    requirements,
    completedCount,
    totalCount,
    missing,
    canActivate,
    save
  };
}
