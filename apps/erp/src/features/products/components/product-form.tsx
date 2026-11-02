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
import { Input, InputWithAddon, Select, Textarea } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryPicker } from "@/components/forms/category-picker";
import { BilingualEditorField, BilingualNameFields } from "@/components/forms/editor-form-parts";
import { HoverImageUpload } from "@/components/forms/hover-image-upload";
import { EntityMediaUpload, ProductMediaUpload } from "@/components/forms/entity-media-upload";
import { MultiChoiceField } from "@/components/forms/multi-choice-field";
import { RelatedItemsField } from "@/components/forms/related-items-field";
import type { ProductFormProps } from "@/features/products/types";
import { ColorDot, ColorPick, colorLabel } from "@/features/products/components/color-pick";

const STEPS = [
  { id: "basics", label: "الأساسيات", title: "ما هو هذا المنتج؟", description: "الاسم والوصف باللغتين، ثم القسم والماركة والمورد والأنواع والأعمار والكلمات المفتاحية." },
  { id: "media", label: "الوسائط", title: "صور المنتج", description: "الصور والفيديو العامة، وصور كل لون، وصورة التمرير التي تظهر على بطاقة المنتج." },
  { id: "pricing", label: "المقاسات والأسعار", title: "المقاسات والألوان والأسعار", description: "لكل مقاس سعر بيع، ولكل مقاس ولون مخزون، وسعر الشراء للاستخدام الداخلي." },
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
export function ProductForm({ mode, initial, categories, attributes, relatedOptions = [], relatedItemsAvailable = true }: ProductFormProps) {
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
        <div className={FIELD_GRID}>
          <Field label="الماركة (اختياري)" htmlFor="product-brand">
            <Select
              id="product-brand"
              value={brandId ?? ""}
              onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— بدون ماركة —</option>
              {(attributes?.brands ?? []).map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name.ar}</option>
              ))}
            </Select>
          </Field>
          <Field label="المورد" htmlFor="product-supplier" hint="للاستخدام الداخلي، لا يظهر للعملاء." error={errors.supplierId}>
            <Select
              id="product-supplier"
              aria-invalid={Boolean(errors.supplierId) || undefined}
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— اختاري المورد —</option>
              {(attributes?.suppliers ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="الأنواع (اختياري)" hint="اختاري نوعًا واحدًا أو أكثر إن وجد.">
          <MultiChoiceField
            legend="الأنواع"
            options={(attributes?.genders ?? []).map((gender) => ({ id: gender.id, label: gender.name.ar }))}
            value={genderIds}
            onChange={setGenderIds}
            emptyText="لا توجد أنواع بعد. أضيفيها من صفحة «الأنواع»."
          />
        </Field>
        <Field label="الفئات العمرية (اختياري)" hint="اختاري فئة واحدة أو أكثر إن وجدت.">
          <MultiChoiceField
            legend="الفئات العمرية"
            options={(attributes?.ageGroups ?? []).map((age) => ({ id: age.id, label: age.name.ar }))}
            value={ageGroupIds}
            onChange={setAgeGroupIds}
            emptyText="لا توجد فئات عمرية بعد. أضيفيها من صفحة «الفئات العمرية»."
          />
        </Field>
        {/* Multi-line, not one line: a long keyword list was unreadable on a phone. */}
        <Field label="كلمات مفتاحية" htmlFor="product-keywords" hint="افصلي بينها بفاصلة أو سطر جديد. تساعد العملاء في البحث." error={errors.keywords}>
          <Textarea
            id="product-keywords"
            rows={3}
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
        <section className="grid gap-3">
          {colors.length > 0 ? (
            <div>
              <h3 className="text-base font-bold text-text-strong">الصور العامة</h3>
              <p className="text-sm text-text-muted">تظهر للون الذي ليست له صور خاصة. اختيارية عند وجود صور للألوان.</p>
            </div>
          ) : null}
          <ProductMediaUpload value={media} onChange={setMedia} uploadContext={uploadContext} />
          {errors.image ? (
            <p role="alert" className="text-sm text-danger">
              {errors.image}
            </p>
          ) : null}
        </section>
        {colors.map((color, index) => (
          <section key={color.id} className="grid gap-3 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <ColorDot hex={color.hex} />
              <div>
                <h3 className="text-base font-bold text-text-strong">صور اللون: <bdi>{colorLabel(color, index)}</bdi></h3>
                <p className="text-sm text-text-muted">تظهر في المتجر عندما يختار العميل هذا اللون، مهما كان المقاس.</p>
              </div>
            </div>
            <EntityMediaUpload
              value={color.media}
              onChange={(next) => updateColor(color.id, { media: next })}
              uploadContext={uploadContext}
              entityLabel="لون"
              testIdPrefix={`product-color-${index}`}
            />
          </section>
        ))}
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
        {errors.variants ? <Alert tone="danger">{errors.variants}</Alert> : null}
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-text-strong">المقاسات والأسعار</h3>
              <p className="text-sm text-text-muted">كل الألوان في المقاس الواحد لها نفس السعر. اتركي المقاس فارغًا إذا لم يكن للمنتج مقاسات.</p>
            </div>
            <Button size="sm" onClick={addSize}>
              <Plus /> إضافة مقاس
            </Button>
          </div>
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-3 px-0.5 text-xs font-medium text-text-muted @lg:grid">
            <span>المقاس</span>
            <span>سعر البيع</span>
          </div>
          <ol className="grid gap-2">
            {sizes.map((size, index) => (
              <li
                key={size.key}
                className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control bg-sunken p-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] @lg:items-center @lg:bg-transparent @lg:p-0"
              >
                <div className="col-span-2 flex items-center justify-between @lg:hidden">
                  <span className="text-sm font-medium text-text-2">
                    مقاس <span className="num">{formatNumber(index + 1)}</span>
                  </span>
                  <Button variant="danger-ghost" size="icon-sm" aria-label="حذف المقاس" disabled={sizes.length === 1} onClick={() => removeSize(size.key)}>
                    <Trash2 />
                  </Button>
                </div>
                <Field label={<span className="@lg:sr-only">المقاس</span>} htmlFor={`size-label-${size.key}`}>
                  <Input
                    id={`size-label-${size.key}`}
                    value={size.label}
                    onChange={(e) => updateSize(size.key, { label: e.target.value })}
                    placeholder={sizes.length === 1 ? "بدون مقاس" : "مثال: S"}
                  />
                </Field>
                <Field label={<span className="@lg:sr-only">سعر البيع</span>} htmlFor={`size-price-${size.key}`}>
                  <InputWithAddon
                    id={`size-price-${size.key}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    className="num"
                    addon="ج.م"
                    value={size.price}
                    onChange={(e) => updateSize(size.key, { price: Number(e.target.value) })}
                  />
                </Field>
                <Button
                  variant="danger-ghost"
                  size="icon"
                  aria-label="حذف المقاس"
                  className="hidden @lg:inline-flex"
                  disabled={sizes.length === 1}
                  onClick={() => removeSize(size.key)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        </section>
        <section className="grid gap-2 border-t border-line pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-text-strong">الألوان (اختياري)</h3>
              <p className="text-sm text-text-muted">اختاري اللون من اللوحة أو اكتبي اسمه. لكل لون صوره الخاصة في خطوة الوسائط.</p>
            </div>
            <Button size="sm" onClick={addColor}>
              <Plus /> إضافة لون
            </Button>
          </div>
          {colors.length === 0 ? (
            <p className="rounded-control bg-sunken px-3 py-2.5 text-sm text-text-muted">بدون ألوان — لا يظهر اختيار اللون في المتجر.</p>
          ) : (
            <>
              <div aria-hidden className="hidden grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-3 px-0.5 text-xs font-medium text-text-muted @lg:grid">
                <span>اللون</span>
                <span>الاسم بالعربية</span>
                <span>الاسم بالإنجليزية</span>
              </div>
              <ol className="grid gap-2">
                {colors.map((color, index) => (
                  <li
                    key={color.id}
                    className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control bg-sunken p-3 @lg:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] @lg:items-center @lg:bg-transparent @lg:p-0"
                  >
                    <div className="col-span-2 flex items-center justify-between @lg:hidden">
                      <span className="text-sm font-medium text-text-2">
                        لون <span className="num">{formatNumber(index + 1)}</span>
                      </span>
                      <Button variant="danger-ghost" size="icon-sm" aria-label={`حذف اللون ${colorLabel(color, index)}`} onClick={() => removeColor(color.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                    <Field label={<span className="@lg:sr-only">اللون</span>} htmlFor={`color-hex-${color.id}`} className="col-span-2 @lg:col-span-1">
                      <ColorPick id={`color-hex-${color.id}`} value={color.hex} onChange={(hex) => updateColor(color.id, { hex })} />
                    </Field>
                    <Field label={<span className="@lg:sr-only">الاسم بالعربية</span>} htmlFor={`color-ar-${color.id}`}>
                      <Input
                        id={`color-ar-${color.id}`}
                        value={color.name.ar}
                        onChange={(e) => updateColor(color.id, { name: { ...color.name, ar: e.target.value } })}
                        placeholder="مثال: أحمر"
                      />
                    </Field>
                    <Field label={<span className="@lg:sr-only">الاسم بالإنجليزية</span>} htmlFor={`color-en-${color.id}`}>
                      <Input
                        id={`color-en-${color.id}`}
                        dir="ltr"
                        value={color.name.en}
                        onChange={(e) => updateColor(color.id, { name: { ...color.name, en: e.target.value } })}
                        placeholder="e.g. Red"
                      />
                    </Field>
                    <Button variant="danger-ghost" size="icon" aria-label={`حذف اللون ${colorLabel(color, index)}`} className="hidden @lg:inline-flex" onClick={() => removeColor(color.id)}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
        <section className="grid gap-3 border-t border-line pt-5">
          <div>
            <h3 className="text-base font-bold text-text-strong">المخزون</h3>
            <p className="text-sm text-text-muted">عدد القطع المتاحة لكل مقاس{colors.length > 0 ? " ولون" : ""}.</p>
          </div>
          <div className="grid gap-3">
            {sizes.map((size, sizeIndex) => (
              <fieldset key={size.key} className="grid gap-2 rounded-control bg-sunken p-3">
                <legend className="sr-only">مخزون {size.label.trim() || `المقاس ${sizeIndex + 1}`}</legend>
                {sizes.length > 1 || size.label.trim() ? (
                  <p aria-hidden className="text-sm font-medium text-text-strong">{size.label.trim() || `مقاس ${formatNumber(sizeIndex + 1)}`}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
                  {(colors.length > 0 ? colors : [null]).map((color, colorIndex) => {
                    const colorId = color?.id ?? null;
                    const inputId = `stock-${size.key}-${colorId ?? 0}`;
                    return (
                      <Field
                        key={colorId ?? 0}
                        htmlFor={inputId}
                        label={color ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <ColorDot hex={color.hex} />
                            <bdi className="truncate">{colorLabel(color, colorIndex)}</bdi>
                          </span>
                        ) : "المخزون"}
                      >
                        <Input
                          id={inputId}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          className="num"
                          value={stockOf(size.key, colorId)}
                          onChange={(e) => setStock(size.key, colorId, Number(e.target.value))}
                        />
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
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
