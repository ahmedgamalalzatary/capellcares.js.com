"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useProductForm } from "@/features/products/hooks/use-product-form";
import { StepCount, Stepper } from "@/components/admin/stepper";
import { useWizardSteps } from "@/hooks/use-wizard-steps";
import { Alert } from "@/components/ui/alert";
import { Swatch } from "@/components/ui/badge";
import { StatusChoice } from "@/components/forms/status-choice";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, InputWithAddon } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryPicker } from "@/components/forms/category-picker";
import { BilingualEditorField, BilingualNameFields } from "@/components/forms/editor-form-parts";
import { HoverImageUpload } from "@/components/forms/hover-image-upload";
import { ProductMediaUpload } from "@/components/forms/entity-media-upload";
import { RelatedItemsField } from "@/components/forms/related-items-field";
import type { ProductFormProps } from "@/features/products/types";

const STEPS = [
  { id: "basics", label: "الأساسيات", title: "ما هو هذا المنتج؟", description: "الاسم والوصف باللغتين، ثم القسم والكلمات المفتاحية." },
  { id: "media", label: "الوسائط", title: "صور المنتج", description: "الصور والفيديو، وصورة التمرير التي تظهر على بطاقة المنتج." },
  { id: "pricing", label: "المقاسات والأسعار", title: "المقاسات والأسعار", description: "لكل مقاس سعر بيع ومخزون، وسعر الشراء للاستخدام الداخلي." },
  { id: "details", label: "التفاصيل والنشر", title: "التفاصيل والنشر", description: "المكونات وطريقة الاستخدام والتحذيرات، ثم العناصر المرتبطة وحالة المنتج." },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STATUS_OPTIONS = [
  { value: "inactive", label: "مسودة", hint: "مخفي عن المتجر", tone: "neutral" },
  { value: "active", label: "نشط", hint: "يظهر في المتجر", tone: "success" },
] as const;

/** Same two-column grid on every step so fields line up in rows and columns. */
const FIELD_GRID = "grid gap-x-4 gap-y-5 @lg:grid-cols-2";

/**
 * Product editor as a wizard. Creating: steps unlock in order and "التالي" checks the step's required
 * data ("حفظ كمسودة" saves from any step). Editing: every step is clickable and "حفظ التعديلات" works anywhere.
 */
export function ProductForm({ mode, initial, categories, relatedOptions = [], relatedItemsAvailable = true }: ProductFormProps) {
  const router = useRouter();
  const editing = mode === "edit";
  const [saving, setSaving] = useState(false);
  const {
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
    arHoverImagePath, setArHoverImagePath,
    enHoverImagePath, setEnHoverImagePath,
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
    checkRequirements,
    missing,
    canActivate,
    save
  } = useProductForm({ initial, relatedOptions });

  const { step, current, goTo, next, stepIndex, stepItems, reached } = useWizardSteps({
    steps: STEPS,
    requirements,
    editing,
    checkRequirements
  });

  const uploadContext = editing ? "products.update" : "products.create";

  const submit = async (asStatus?: "inactive") => {
    setSaving(true);
    const saved = await save(asStatus ? { asStatus } : {});
    setSaving(false);
    if (saved) {
      router.push("/products");
      return;
    }
    // Open the step holding the first problem (validation mirrors use-product-form).
    const publishing = (asStatus ?? status) === "active";
    const target = publishing ? missing[0]?.target : !nameAr.trim() && !nameEn.trim() ? "basics" : undefined;
    if (target) goTo(stepIndex(target as StepId));
  };

  const isLast = step === STEPS.length - 1;

  const stepContent: Record<StepId, ReactNode> = {
    basics: (
      <div className="grid gap-5">
        <div className={FIELD_GRID}>
          <BilingualNameFields
            arValue={nameAr}
            enValue={nameEn}
            onArChange={setNameAr}
            onEnChange={setNameEn}
            arError={errors.nameAr}
            enError={errors.nameEn}
          />
        </div>
        <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
        <Field label="القسم" htmlFor="product-category" error={errors.categoryId}>
          <CategoryPicker id="product-category" categories={categories} value={categoryId} onChange={setCategoryId} />
        </Field>
        <Field label="كلمات مفتاحية" htmlFor="product-keywords" hint="افصلي بينها بفاصلة. تساعد العملاء في البحث." error={errors.keywords}>
          <Input
            id="product-keywords"
            aria-invalid={Boolean(errors.keywords) || undefined}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="مثال: ترطيب، جسم، لوشن"
          />
        </Field>
      </div>
    ),
    media: (
      <div className="grid gap-6">
        <div className="grid gap-3">
          <ProductMediaUpload value={media} onChange={setMedia} uploadContext={uploadContext} />
          {errors.image ? (
            <p role="alert" className="text-sm text-danger">
              {errors.image}
            </p>
          ) : null}
        </div>
        <section className="grid gap-3 border-t border-line pt-5">
          <div>
            <h3 className="text-base font-bold text-text-strong">صورة التمرير</h3>
            <p className="text-sm text-text-muted">تظهر على بطاقة المنتج عند مرور المؤشر عليها. اختيارية.</p>
          </div>
          <HoverImageUpload
            arValue={arHoverImagePath}
            enValue={enHoverImagePath}
            onChange={(lang, value) => (lang === "ar" ? setArHoverImagePath(value) : setEnHoverImagePath(value))}
            uploadContext={uploadContext}
            entityLabel="منتج"
            testIdPrefix="product"
          />
        </section>
      </div>
    ),
    pricing: (
      <div className="grid gap-6">
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-text-strong">المقاسات</h3>
            <Button size="sm" onClick={addVariant}>
              <Plus /> إضافة مقاس
            </Button>
          </div>
          {errors.variants ? <Alert tone="danger">{errors.variants}</Alert> : null}
          <div aria-hidden className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-3 px-0.5 text-xs font-medium text-text-muted @lg:grid">
            <span>المقاس</span>
            <span>سعر البيع</span>
            <span>المخزون</span>
          </div>
          <ol className="grid gap-2">
            {variants.map((v, index) => (
              <li
                key={v.id}
                className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control bg-sunken p-3 @lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_2.75rem] @lg:items-center @lg:bg-transparent @lg:p-0"
              >
                <div className="col-span-2 flex items-center justify-between @lg:hidden">
                  <span className="text-sm font-medium text-text-2">
                    مقاس <span className="num">{formatNumber(index + 1)}</span>
                  </span>
                  <Button variant="danger-ghost" size="icon-sm" aria-label="حذف المقاس" disabled={variants.length === 1} onClick={() => removeVariant(v.id)}>
                    <Trash2 />
                  </Button>
                </div>
                <Field label={<span className="@lg:sr-only">المقاس</span>} htmlFor={`variant-size-${v.id}`} className="col-span-2 @lg:col-span-1">
                  <Input id={`variant-size-${v.id}`} value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} placeholder="100ml" />
                </Field>
                <Field label={<span className="@lg:sr-only">سعر البيع</span>} htmlFor={`variant-price-${v.id}`}>
                  <InputWithAddon
                    id={`variant-price-${v.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    className="num"
                    addon="ج.م"
                    value={v.price}
                    onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })}
                  />
                </Field>
                <Field label={<span className="@lg:sr-only">المخزون</span>} htmlFor={`variant-stock-${v.id}`}>
                  <Input
                    id={`variant-stock-${v.id}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="num"
                    value={v.stock}
                    onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })}
                  />
                </Field>
                <Button
                  variant="danger-ghost"
                  size="icon"
                  aria-label="حذف المقاس"
                  className="hidden @lg:inline-flex"
                  disabled={variants.length === 1}
                  onClick={() => removeVariant(v.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        </section>
        <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
          <Field label="سعر الشراء" htmlFor="product-buying-price" hint="للاستخدام الداخلي، لا يظهر للعملاء." error={errors.buyingPrice}>
            <InputWithAddon
              id="product-buying-price"
              type="number"
              inputMode="decimal"
              min="0"
              className="num"
              addon="ج.م"
              aria-invalid={Boolean(errors.buyingPrice) || undefined}
              value={buyingPrice}
              onChange={(e) => setBuyingPrice(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    ),
    details: (
      <div className="grid gap-5">
        <BilingualEditorField label="المكونات" arValue={ingAr} onArChange={setIngAr} enValue={ingEn} onEnChange={setIngEn} multiline />
        <BilingualEditorField label="طريقة الاستخدام" arValue={useAr} onArChange={setUseAr} enValue={useEn} onEnChange={setUseEn} multiline />
        <BilingualEditorField label="تحذيرات" arValue={warnAr} onArChange={setWarnAr} enValue={warnEn} onEnChange={setWarnEn} multiline />
        <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
          <Field label="رمز المنتج (SKU)" htmlFor="product-sku" hint="اختياري — يُنشأ تلقائيًا إذا تُرك فارغًا.">
            <Input id="product-sku" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BODY-LOTION-ROSE-200ML" />
          </Field>
          <Field label="رابط فيديو يوتيوب" htmlFor="product-youtube" hint="اختياري.">
            <Input id="product-youtube" dir="ltr" inputMode="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" />
          </Field>
        </div>
        <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
          <section className="grid content-start gap-3">
            <div>
              <h3 className="text-base font-bold text-text-strong">العناصر المرتبطة</h3>
              <p className="text-sm text-text-muted">منتجات أو عروض أو مجموعات تُقترح مع هذا المنتج.</p>
            </div>
            {!relatedItemsAvailable ? (
              <Alert tone="warning">
                تعذر تحميل العناصر المرتبطة الحالية، لذلك أُوقف هذا القسم مؤقتًا حتى لا تُحذف. يمكنك تعديل باقي البيانات وحفظها.
              </Alert>
            ) : null}
            <RelatedItemsField
              value={relatedItems ?? []}
              options={relatedSelectableOptions}
              onChange={setRelatedItems}
              disabled={!relatedItemsAvailable}
            />
          </section>
          <section className="grid content-start gap-4">
            <div>
              <h3 className="text-base font-bold text-text-strong">حالة المنتج</h3>
              <p className="text-sm text-text-muted">المسودة مخفية عن المتجر حتى تنشريها.</p>
            </div>
            <StatusChoice name="product-status" value={status} onChange={setStatus} legend="حالة المنتج" options={STATUS_OPTIONS} />
            {canActivate ? (
              <p className="flex items-center gap-2 text-sm text-text-2">
                <Swatch tone="success" /> كل بيانات النشر مكتملة.
              </p>
            ) : (
              <div className="grid gap-1.5">
                <p className="text-sm text-text-2">مطلوب قبل النشر:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {missing.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => goTo(stepIndex(r.target as StepId))}
                        className="inline-flex h-7 items-center rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning transition-colors hover:bg-warning-soft/70 pointer-coarse:h-9"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 border-t border-line pt-4">
              <SwitchField label="شارة «جديد»" checked={isNew} onCheckedChange={setIsNew} />
              <SwitchField label="شارة «الأكثر مبيعًا»" checked={isBestseller} onCheckedChange={setIsBestseller} />
            </div>
          </section>
        </div>
      </div>
    ),
  };

  const primaryLabel = editing ? "حفظ التعديلات" : status === "active" ? "نشر المنتج" : "حفظ المنتج";

  return (
    <div className="grid gap-5">
      <Stepper steps={stepItems} current={step} isReachable={(index) => index <= reached} onSelect={goTo} />

      <Card>
        <CardHeader title={current.title} description={current.description} actions={<StepCount current={step} total={STEPS.length} />} />
        <CardBody className="@container">{stepContent[current.id]}</CardBody>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
          <Button variant="ghost" onClick={() => router.push("/products")}>
            إلغاء
          </Button>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowRight /> السابق
              </Button>
            ) : null}
            {!editing && !isLast ? (
              <Button variant="ghost" className="underline underline-offset-4" disabled={saving} onClick={() => void submit("inactive")}>
                حفظ كمسودة
              </Button>
            ) : null}
            {!isLast ? (
              <Button variant={editing ? "secondary" : "primary"} onClick={next}>
                التالي <ArrowLeft />
              </Button>
            ) : null}
            {editing || isLast ? (
              <Button variant="primary" disabled={saving} onClick={() => void submit()}>
                {saving ? "جارٍ الحفظ…" : primaryLabel}
              </Button>
            ) : null}
          </div>
        </footer>
      </Card>
    </div>
  );
}
