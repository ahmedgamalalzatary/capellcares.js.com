"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, Plus, Trash2, ArrowUp } from "lucide-react";
import { StepCount, Stepper, type StepItem } from "@/components/admin/stepper";
import { Alert } from "@/components/ui/alert";
import { Swatch } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, InputWithAddon, Select } from "@/components/ui/input";
import { getDescendantCategoryIds } from "@/lib/category-tree";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useOfferForm } from "../../hooks/forms/use-offer-form";
import type { OfferFormProps } from "../../types/forms/offer-form.types";
import { CategoryPicker } from "./category-picker";
import { BilingualEditorField, BilingualNameFields } from "./editor-form-parts";
import { HoverImageUpload } from "./hover-image-upload";
import { EntityMediaUpload } from "@/components/forms/entity-media-upload";
import { RelatedItemsField } from "./related-items-field";

const STEPS = [
  { id: "basics", label: "الأساسيات", title: "ما هو هذا العرض؟", description: "الاسم باللغتين، القسم، والوصف الظاهر للعميل." },
  { id: "bundle", label: "الباقة والأسعار", title: "منتجات الباقة وسعرها", description: "اختاري المنتجات ومقاساتها وحدّدي سعر الباقة." },
  { id: "media", label: "الوسائط", title: "صور العرض", description: "صور العرض والفيديو، وصورة التمرير على بطاقة العرض." },
  { id: "related", label: "العناصر المرتبطة", title: "العناصر المرتبطة", description: "منتجات أو عروض أو مجموعات تُقترح مع هذا العرض." }
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STATUS_OPTIONS = [
  { value: "inactive", label: "مسودة", hint: "مخفي عن المتجر", tone: "neutral" },
  { value: "active", label: "نشط", hint: "يظهر في المتجر", tone: "success" }
] as const;

/** Same two-column grid on every step so fields line up in rows and columns. */
const FIELD_GRID = "grid gap-x-4 gap-y-5 @lg:grid-cols-2";

export function OfferForm({ mode, initial, products, categories, relatedOptions = [], relatedItemsAvailable = true }: OfferFormProps) {
  const router = useRouter();
  const editing = mode === "edit";
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? STEPS.length - 1 : 0);
  const [saving, setSaving] = useState(false);
  const {
    nameAr, setNameAr,
    nameEn, setNameEn,
    descAr, setDescAr,
    descEn, setDescEn,
    price, setPrice,
    youtubeUrl, setYoutubeUrl,
    media, setMedia,
    arHoverImagePath, setArHoverImagePath,
    enHoverImagePath, setEnHoverImagePath,
    status, setStatus,
    categoryId, setCategoryId,
    rows, relatedItems, setRelatedItems,
    errors, relatedSelectableOptions, computed,
    addRow, removeRow, moveRow, updateRow,
    requirements, checkRequirements, missing, canPublish,
    save
  } = useOfferForm({ mode, initial, products, categories, relatedOptions, relatedItemsAvailable });

  const uploadContext = editing ? "offers.update" : "offers.create";
  const savings = computed.originalTotal - Number(price || 0);
  const rootCategories = categories.filter((category) => category.parentId == null);
  const allowedCategoryIds = categoryId != null ? getDescendantCategoryIds(categories, categoryId) : null;
  // A legacy offer opens with no category; until a category is picked every product stays listed so existing rows don't read as empty.
  const categoryProducts = products.filter(
    (product) => !product.deletedAt && (allowedCategoryIds == null || allowedCategoryIds.has(product.categoryId))
  );

  const stepIndex = (id: StepId) => STEPS.findIndex((candidate) => candidate.id === id);

  const goTo = (index: number) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const keys = requirements.filter((requirement) => requirement.target === STEPS[step]!.id).map((requirement) => requirement.key);
    if (!editing && !checkRequirements(keys)) return;
    goTo(step + 1);
  };

  const submit = async (asStatus?: "inactive") => {
    setSaving(true);
    const didSave = await save(asStatus ? { asStatus } : {});
    setSaving(false);
    if (didSave) {
      router.push("/offers");
      return;
    }
    const publishing = (asStatus ?? status) === "active";
    const target = publishing ? missing[0]?.target : !nameAr.trim() && !nameEn.trim() ? "basics" : undefined;
    if (target) goTo(stepIndex(target as StepId));
  };

  const stepItems: StepItem[] = STEPS.map((item, index) => {
    const required = requirements.filter((requirement) => requirement.target === item.id);
    const unmet = required.some((requirement) => !requirement.ok);
    const seen = editing || index < step || index < reached;
    if (unmet) return { id: item.id, label: item.label, state: seen ? "missing" : "todo" };
    return { id: item.id, label: item.label, state: seen ? "done" : "todo" };
  });

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const primaryLabel = editing ? "حفظ التعديلات" : status === "active" ? "نشر العرض" : "حفظ العرض";

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
        <div className={FIELD_GRID}>
          <Field label="القسم" htmlFor="offer-category" error={errors.categoryId}>
            <CategoryPicker id="offer-category" categories={rootCategories} value={categoryId} onChange={setCategoryId} />
          </Field>
          <Field label="رابط فيديو يوتيوب" htmlFor="offer-youtube" hint="اختياري.">
            <Input id="offer-youtube" dir="ltr" inputMode="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtube.com/…" />
          </Field>
        </div>
        <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
      </div>
    ),
    bundle: (
      <div className="grid gap-6">
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-text-strong">المنتجات داخل الباقة</h3>
              <p className="text-sm text-text-muted">يجب أن ينتمي كل منتج إلى القسم المختار أو أحد أقسامه الفرعية.</p>
            </div>
            <Button size="sm" onClick={addRow}>
              <Plus /> إضافة منتج
            </Button>
          </div>
          {errors.rows ? <Alert tone="danger">{errors.rows}</Alert> : null}
          {rows.length === 0 ? (
            <div className="grid justify-items-center gap-2 rounded-well border border-dashed border-line-strong bg-sunken px-6 py-10 text-center">
              <p className="text-base font-medium text-text-strong">لا توجد منتجات في الباقة بعد</p>
              <p className="max-w-sm text-sm text-text-muted">اضغطي «إضافة منتج» لاختيار أول منتج في الباقة.</p>
            </div>
          ) : (
            <>
              <div aria-hidden className="hidden gap-3 px-0.5 text-xs font-medium text-text-muted @2xl:grid @2xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem]">
                <span>المنتج</span>
                <span>المقاس</span>
                <span>الكمية</span>
                <span>السعر الفردي</span>
                <span>المجموع</span>
                <span />
              </div>
              <ol className="grid gap-2">
              {rows.map((row, index) => {
                const product = products.find((candidate) => candidate.id === row.productId);
                const variants = product?.variants ?? [];
                const variant = variants.find((candidate) => candidate.id === row.variantId);
                return (
                  <li
                    key={row.id ?? index}
                    data-testid="bundle-item-row"
                    className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-control bg-sunken p-3 @2xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_5.5rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] @2xl:items-center @2xl:bg-transparent @2xl:p-0"
                  >
                    <div className="col-span-2 flex items-center justify-between @2xl:hidden">
                      <span className="text-sm font-medium text-text-2">
                        عنصر <span className="num">{formatNumber(index + 1)}</span>
                      </span>
                      <Button variant="danger-ghost" size="icon-sm" aria-label="حذف العنصر" onClick={() => removeRow(index)}>
                        <Trash2 />
                      </Button>
                    </div>
                    <Field label={<span className="@2xl:sr-only">المنتج</span>} htmlFor={`offer-item-product-${index}`} className="col-span-2 @2xl:col-span-1">
                      <Select id={`offer-item-product-${index}`} value={row.productId} onChange={(event) => updateRow(index, { productId: Number(event.target.value) })}>
                        <option value={0}>— اختاري منتجًا —</option>
                        {categoryProducts.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>{candidate.name.ar}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={<span className="@2xl:sr-only">المقاس</span>} htmlFor={`offer-item-variant-${index}`}>
                      <Select id={`offer-item-variant-${index}`} disabled={!product} value={row.variantId} onChange={(event) => updateRow(index, { variantId: Number(event.target.value) })}>
                        <option value={0}>— مقاس —</option>
                        {variants.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>{candidate.size}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={<span className="@2xl:sr-only">الكمية</span>} htmlFor={`offer-item-qty-${index}`}>
                      <Input
                        id={`offer-item-qty-${index}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="num"
                        value={row.qty}
                        onChange={(event) => updateRow(index, { qty: Number(event.target.value) })}
                      />
                    </Field>
                    <div className="grid content-start gap-1.5">
                      <span className="text-sm font-medium text-text-2 @2xl:sr-only">السعر الفردي</span>
                      <span className="num flex h-10 items-center text-text-2 @2xl:h-auto">{variant ? formatMoney(variant.price) : "—"}</span>
                    </div>
                    <div className="grid content-start gap-1.5">
                      <span className="text-sm font-medium text-text-2 @2xl:sr-only">المجموع</span>
                      <span className="num flex h-10 items-center font-medium text-text-strong @2xl:h-auto">{variant ? formatMoney(variant.price * row.qty) : "—"}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-0.5 @2xl:col-span-1">
                      {rows.length > 1 ? (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => moveRow(index, -1)}>
                            <ArrowUp />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" disabled={index === rows.length - 1} onClick={() => moveRow(index, 1)}>
                            <ArrowDown />
                          </Button>
                        </>
                      ) : null}
                      <Button variant="danger-ghost" size="icon-sm" aria-label="حذف العنصر" className="hidden @2xl:inline-flex" onClick={() => removeRow(index)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
            </>
          )}
        </section>

        <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
          <Field label="سعر الباقة" htmlFor="offer-price" error={errors.price} hint="السعر الذي يدفعه العميل للباقة كاملة.">
            <InputWithAddon
              id="offer-price"
              type="number"
              inputMode="decimal"
              min="0"
              className="num"
              addon="ج.م"
              aria-invalid={Boolean(errors.price) || undefined}
              value={price}
              onChange={(event) => setPrice(Number(event.target.value))}
            />
          </Field>
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-medium text-text-2">ملخّص الحساب</span>
            <div className="grid gap-1.5 rounded-control bg-sunken px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">السعر الأصلي</span>
                <span className="num text-text-2">{formatMoney(computed.originalTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">التوفير</span>
                <span className={cn("num font-medium", savings > 0 ? "text-success" : "text-text-muted")}>{formatMoney(Math.max(0, savings))}</span>
              </div>
            </div>
          </div>
        </div>
        {savings < 0 ? <Alert tone="warning">سعر الباقة أعلى من السعر الأصلي لمجموع المنتجات.</Alert> : null}
      </div>
    ),
    media: (
      <div className="grid gap-6">
        <div className="grid gap-3">
          <EntityMediaUpload value={media} onChange={setMedia} uploadContext={uploadContext} entityLabel="عرض" testIdPrefix="offer" />
          {errors.image ? <p role="alert" className="text-sm text-danger">{errors.image}</p> : null}
        </div>
        <section className="grid gap-3 border-t border-line pt-5">
          <div>
            <h3 className="text-base font-bold text-text-strong">صورة التمرير</h3>
            <p className="text-sm text-text-muted">تظهر على بطاقة العرض عند مرور المؤشر عليها. اختيارية.</p>
          </div>
          <HoverImageUpload
            arValue={arHoverImagePath}
            enValue={enHoverImagePath}
            onChange={(lang, value) => (lang === "ar" ? setArHoverImagePath(value) : setEnHoverImagePath(value))}
            uploadContext={uploadContext}
            entityLabel="عرض"
            testIdPrefix="offer"
          />
        </section>
      </div>
    ),
    related: (
      <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
        <section className="grid content-start gap-3">
          <div>
            <h3 className="text-base font-bold text-text-strong">العناصر المرتبطة</h3>
            <p className="text-sm text-text-muted">منتجات أو عروض أو مجموعات تُقترح مع هذا العرض.</p>
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
            <h3 className="text-base font-bold text-text-strong">حالة العرض</h3>
            <p className="text-sm text-text-muted">المسودة مخفية عن المتجر حتى تنشريها.</p>
          </div>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">حالة العرض</legend>
            {STATUS_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "grid cursor-pointer gap-0.5 rounded-control bg-surface p-3 shadow-[0_0_0_1px_var(--line-control)] transition-shadow",
                  "hover:shadow-[0_0_0_1px_var(--line-strong)]",
                  "has-checked:bg-sunken has-checked:shadow-[0_0_0_2px_var(--sand-900)]",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
                )}
              >
                <input
                  type="radio"
                  name="offer-status"
                  value={option.value}
                  className="sr-only"
                  checked={status === option.value}
                  onChange={() => setStatus(option.value)}
                />
                <span className="flex items-center gap-2 text-base font-medium text-text-strong">
                  <Swatch tone={option.tone} />
                  {option.label}
                </span>
                <span className="text-xs text-text-muted">{option.hint}</span>
              </label>
            ))}
          </fieldset>
          {canPublish ? (
            <p className="flex items-center gap-2 text-sm text-text-2">
              <Swatch tone="success" /> كل بيانات النشر مكتملة.
            </p>
          ) : (
            <div className="grid gap-1.5">
              <p className="text-sm text-text-2">مطلوب قبل النشر:</p>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((requirement) => (
                  <li key={requirement.key}>
                    <button
                      type="button"
                      onClick={() => goTo(stepIndex(requirement.target as StepId))}
                      className="inline-flex h-7 items-center rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning transition-colors hover:bg-warning-soft/70 pointer-coarse:h-9"
                    >
                      {requirement.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    )
  };

  return (
    <div className="grid gap-5">
      <Stepper steps={stepItems} current={step} isReachable={(index) => index <= reached} onSelect={goTo} />

      <Card>
        <CardHeader title={current.title} description={current.description} actions={<StepCount current={step} total={STEPS.length} />} />
        <CardBody className="@container">{stepContent[current.id]}</CardBody>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
          <Button variant="ghost" onClick={() => router.push("/offers")}>إلغاء</Button>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowRight /> السابق
              </Button>
            ) : null}
            {!isLast ? (
              <Button variant={editing ? "secondary" : "primary"} onClick={next}>
                التالي <ArrowLeft />
              </Button>
            ) : null}
            {!editing && !isLast ? (
              <Button variant="ghost" className="underline underline-offset-4" disabled={saving} onClick={() => { void submit("inactive"); }}>
                حفظ كمسودة
              </Button>
            ) : null}
            {editing || isLast ? (
              <Button variant="primary" disabled={saving} onClick={() => { void submit(); }}>
                {saving ? "جارٍ الحفظ…" : primaryLabel}
              </Button>
            ) : null}
          </div>
        </footer>
      </Card>
    </div>
  );
}
