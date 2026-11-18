"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Wand2, X } from "lucide-react";
import { generatePromoCode, type PromoTargetInput } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { formatMoney, formatNumber } from "@/lib/format";
import { GIFT_TYPE_LABELS, TARGET_TYPE_LABELS, type PromoCatalog } from "../lib/promo-catalog";
import {
  createEmptyPromoForm,
  describePromoBenefits,
  promoErrorMessage,
  validatePromoForm,
  type PromoCustomer,
  type PromoFormState,
  type PromoGiftType
} from "../lib/promo-form";

const GRID = "grid gap-x-4 gap-y-5 sm:grid-cols-2";

function apiErrorMessages(error: unknown): string[] {
  const keys = (error as { body?: { errors?: unknown } })?.body?.errors;
  return Array.isArray(keys) && keys.length > 0 ? keys.map((key) => promoErrorMessage(String(key))) : [promoErrorMessage("")];
}

function TargetList({
  label,
  targets,
  catalog,
  onChange
}: {
  label: string;
  targets: PromoTargetInput[];
  catalog: PromoCatalog;
  onChange: (targets: PromoTargetInput[]) => void;
}) {
  const labelId = useId();
  const [type, setType] = useState<PromoTargetInput["type"]>("category");
  const [itemId, setItemId] = useState("");
  const options = catalog.options[type];
  const add = () => {
    const id = Number(itemId);
    if (!id || targets.some((target) => target.type === type && target.id === id)) return;
    onChange([...targets, { type, id }]);
    setItemId("");
  };

  return (
    <div role="group" aria-labelledby={labelId} className="grid gap-3 rounded-well bg-sunken p-4">
      <span id={labelId} className="text-base font-medium text-text-strong">{label}</span>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="النوع" htmlFor={`${labelId}-type`}>
          <Select id={`${labelId}-type`} value={type} onChange={(event) => { setType(event.target.value as PromoTargetInput["type"]); setItemId(""); }}>
            {(Object.keys(TARGET_TYPE_LABELS) as Array<PromoTargetInput["type"]>).map((key) => <option key={key} value={key}>{TARGET_TYPE_LABELS[key]}</option>)}
          </Select>
        </Field>
        <Field label="العنصر" htmlFor={`${labelId}-item`}>
          <Select id={`${labelId}-item`} value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="">— اختاري —</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
        </Field>
        <Button type="button" variant="secondary" disabled={!itemId} onClick={add}>إضافة</Button>
      </div>
      {targets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {targets.map((target) => {
            const text = catalog.targetLabel(target);
            return (
              <li key={`${target.type}:${target.id}`} className="flex items-center gap-1 rounded-full bg-canvas px-3 py-1 text-sm">
                <span>{text}</span>
                <button type="button" aria-label={`إزالة ${text}`} className="text-text-muted hover:text-danger"
                  onClick={() => onChange(targets.filter((item) => item !== target))}>
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-text-muted">لا شيء بعد.</p>}
    </div>
  );
}

function CustomerPicker({ customers, onChange }: { customers: PromoCustomer[]; onChange: (customers: PromoCustomer[]) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PromoCustomer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const response = await api.get<{ items: PromoCustomer[] }>(`/api/erp/promo-codes/customers?q=${encodeURIComponent(query.trim())}`);
      setResults(response.items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-well bg-sunken p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="بحث عن عميل" htmlFor="promo-customer-search" className="min-w-56 flex-1">
          <Input id="promo-customer-search" value={query} placeholder="الاسم أو البريد الإلكتروني"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
        </Field>
        <Button type="button" variant="secondary" disabled={searching || query.trim().length < 2} onClick={() => void search()}>بحث</Button>
      </div>
      {results ? (
        results.length === 0 ? <p className="text-sm text-text-muted">لا يوجد عملاء مطابقون.</p> : (
          <ul className="grid gap-1">
            {results.map((customer) => (
              <li key={customer.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{customer.name} <span dir="ltr" className="text-text-muted">{customer.email}</span></span>
                <Button type="button" size="sm" variant="ghost" aria-label={`إضافة ${customer.name}`}
                  disabled={customers.some((item) => item.id === customer.id)}
                  onClick={() => onChange([...customers, customer])}>إضافة</Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      <div className="grid gap-1">
        <span className="text-sm font-medium text-text-2">العملاء المختارون ({formatNumber(customers.length)})</span>
        <ul className="flex flex-wrap gap-2">
          {customers.map((customer) => (
            <li key={customer.id} className="flex items-center gap-1 rounded-full bg-canvas px-3 py-1 text-sm">
              <span>{customer.name}</span>
              <button type="button" aria-label={`إزالة ${customer.name}`} className="text-text-muted hover:text-danger"
                onClick={() => onChange(customers.filter((item) => item.id !== customer.id))}>
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-5">{children}</CardBody>
    </Card>
  );
}

export function PromoCodeForm({ catalog, initial }: { catalog: PromoCatalog; initial?: PromoFormState }) {
  const router = useRouter();
  const [form, setForm] = useState<PromoFormState>(initial ?? createEmptyPromoForm());
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const { payload, errors } = useMemo(() => validatePromoForm(form), [form]);
  const set = <K extends keyof PromoFormState>(key: K, value: PromoFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const input = (key: keyof PromoFormState) => ({
    value: form[key] as string,
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as never)
  });

  const save = async () => {
    if (!payload) return;
    setSaving(true);
    setSaveErrors([]);
    try {
      const created = await api.post<{ id: number }>("/api/erp/promo-codes", payload);
      router.push(`/promo-codes/${created.id}`);
    } catch (error) {
      setSaveErrors(apiErrorMessages(error));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const giftOptions = catalog.giftOptions[form.giftItemType];

  return (
    <div className="grid gap-5">
      <Section title="الكود" description="ما يكتبه العميل. لا يفرق بين الحروف الكبيرة والصغيرة.">
        <div className={GRID}>
          <Field label="الكود" htmlFor="promo-code">
            <div className="flex gap-2">
              <Input id="promo-code" dir="ltr" value={form.code} onChange={(event) => set("code", event.target.value.toUpperCase())} placeholder="SUMMER20" />
              <Button type="button" variant="secondary" onClick={() => set("code", generatePromoCode())}><Wand2 aria-hidden /> توليد كود</Button>
            </div>
          </Field>
          <div />
          <Field label="الاسم بالعربية" htmlFor="promo-ar-name"><Input id="promo-ar-name" {...input("arName")} /></Field>
          <Field label="الاسم بالإنجليزية" htmlFor="promo-en-name"><Input id="promo-en-name" dir="ltr" {...input("enName")} /></Field>
        </div>
      </Section>

      <Section title="المزايا" description="يمكن الجمع بين الخصم والشحن المجاني والهدية في كود واحد.">
        <div className={GRID}>
          <Field label="نوع الخصم" htmlFor="promo-discount-type">
            <Select id="promo-discount-type" value={form.discountType} onChange={(event) => set("discountType", event.target.value as PromoFormState["discountType"])}>
              <option value="">بدون خصم</option>
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
            </Select>
          </Field>
          {form.discountType ? (
            <Field label={form.discountType === "percentage" ? "نسبة الخصم (%)" : "قيمة الخصم (ج.م)"} htmlFor="promo-discount-value"
              hint={form.discountType === "fixed" ? "تُخصم مرة واحدة من إجمالي القطع المشمولة." : undefined}>
              <Input id="promo-discount-value" inputMode="decimal" {...input("discountValue")} />
            </Field>
          ) : <div />}
          {form.discountType === "percentage" ? (
            <Field label="الحد الأقصى للخصم (ج.م، اختياري)" htmlFor="promo-cap"><Input id="promo-cap" inputMode="decimal" {...input("maxDiscountAmount")} /></Field>
          ) : null}
        </div>
        <SwitchField label="شحن مجاني" hint="يدفع المتجر رسوم بوسطة ويُسجَّل المبلغ في التقرير." checked={form.freeShipping} onCheckedChange={(checked) => set("freeShipping", checked)} />
        <SwitchField label="هدية مجانية" hint="تُضاف تلقائيًا بسعر صفر، ولا تُحسب في أي شرط." checked={form.giftEnabled} onCheckedChange={(checked) => set("giftEnabled", checked)} />
        {form.giftEnabled ? (
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-[12rem_1fr_8rem]">
            <Field label="نوع الهدية" htmlFor="promo-gift-type">
              <Select id="promo-gift-type" value={form.giftItemType} onChange={(event) => setForm((current) => ({ ...current, giftItemType: event.target.value as PromoGiftType, giftItemId: "" }))}>
                {(Object.keys(GIFT_TYPE_LABELS) as PromoGiftType[]).map((key) => <option key={key} value={key}>{GIFT_TYPE_LABELS[key]}</option>)}
              </Select>
            </Field>
            <Field label="الهدية" htmlFor="promo-gift-item">
              <Select id="promo-gift-item" {...input("giftItemId")}>
                <option value="">— اختاري —</option>
                {giftOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </Select>
            </Field>
            <Field label="الكمية" htmlFor="promo-gift-qty"><Input id="promo-gift-qty" inputMode="numeric" {...input("giftQty")} /></Field>
          </div>
        ) : null}
      </Section>

      <Section title="المنتجات المشمولة" description="المنتج داخل عرض أو مجموعة لا يُشمل من خلالها؛ اختاري العرض أو المجموعة نفسها.">
        <div role="radiogroup" aria-label="نطاق الكود" className="flex flex-wrap gap-4">
          {([["all", "كل المتجر"], ["selected", "أقسام أو منتجات محددة"]] as const).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-base">
              <input type="radio" name="promo-scope" value={value} checked={form.scope === value} onChange={() => set("scope", value)} />
              {label}
            </label>
          ))}
        </div>
        {form.scope === "selected" ? <TargetList label="يشمل" targets={form.include} catalog={catalog} onChange={(targets) => set("include", targets)} /> : null}
        <TargetList label="يستثني" targets={form.exclude} catalog={catalog} onChange={(targets) => set("exclude", targets)} />
      </Section>

      <Section title="الشروط" description="قيمة الطلب تُحسب بأسعار السلة المعروضة قبل الكود وبدون الشحن.">
        <div className={GRID}>
          <Field label="الحد الأدنى للطلب (ج.م)" htmlFor="promo-min-order"><Input id="promo-min-order" inputMode="decimal" {...input("minOrderAmount")} /></Field>
          <Field label="الحد الأقصى للطلب (ج.م)" htmlFor="promo-max-order"><Input id="promo-max-order" inputMode="decimal" {...input("maxOrderAmount")} /></Field>
          <Field label="أقل عدد قطع مشمولة" htmlFor="promo-min-pieces"><Input id="promo-min-pieces" inputMode="numeric" {...input("minEligiblePieces")} /></Field>
          <Field label="أقصى عدد قطع مخفضة" htmlFor="promo-max-pieces" hint="تُخفض القطع الأغلى سعرًا أولًا.">
            <Input id="promo-max-pieces" inputMode="numeric" {...input("maxDiscountedPieces")} />
          </Field>
        </div>
      </Section>

      <Section title="الاستخدام والعملاء">
        <div className={GRID}>
          <Field label="حد الاستخدام الكلي" htmlFor="promo-total-limit" hint="اتركيه فارغًا لعدد غير محدود."><Input id="promo-total-limit" inputMode="numeric" {...input("totalUsageLimit")} /></Field>
          <Field label="الحد لكل عميل" htmlFor="promo-customer-limit" hint="اتركيه فارغًا لعدد غير محدود."><Input id="promo-customer-limit" inputMode="numeric" {...input("perCustomerLimit")} /></Field>
        </div>
        <SwitchField label="للطلب الأول فقط" hint="يُرفض إذا كان للحساب أو لرقم الهاتف أي طلب سابق، حتى الملغي." checked={form.firstOrderOnly} onCheckedChange={(checked) => set("firstOrderOnly", checked)} />
        <SwitchField label="كود خاص" hint="يستخدمه العملاء المختارون فقط. أرسلي لهم الكود بنفسك." checked={form.isPrivate} onCheckedChange={(checked) => set("isPrivate", checked)} />
        {form.isPrivate ? <CustomerPicker customers={form.customers} onChange={(customers) => set("customers", customers)} /> : null}
      </Section>

      <Section title="المدة" description="بتوقيت القاهرة. بدون تاريخ بداية يبدأ فور الحفظ، وبدون تاريخ انتهاء يستمر حتى تُوقفيه.">
        <div className={GRID}>
          <Field label="يبدأ في" htmlFor="promo-starts"><Input id="promo-starts" type="datetime-local" {...input("startsAt")} /></Field>
          <Field label="ينتهي في" htmlFor="promo-ends"><Input id="promo-ends" type="datetime-local" {...input("endsAt")} /></Field>
        </div>
      </Section>

      {saveErrors.length > 0 ? <Alert tone="danger">{saveErrors.join(" ")}</Alert> : null}
      {errors.length > 0 ? (
        <ul aria-label="ما ينقص الكود" className="grid gap-1 text-sm text-text-muted">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/promo-codes")}>إلغاء</Button>
        <Button type="button" variant="primary" disabled={!payload || saving} onClick={() => setConfirming(true)}>مراجعة وحفظ</Button>
      </div>

      <AdminConfirmModal
        open={confirming && payload !== null}
        title="تأكيد إنشاء الكود"
        confirmLabel="إنشاء الكود"
        disableConfirm={saving}
        onClose={() => setConfirming(false)}
        onConfirm={save}
      >
        {payload ? (
          <div className="grid gap-3 text-sm">
            <p className="text-lg font-bold" dir="ltr">{payload.code}</p>
            <ul className="grid gap-1">
              {describePromoBenefits({ ...payload, gift: payload.gift }).map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
            {payload.minOrderAmount !== null ? <p>الحد الأدنى للطلب: {formatMoney(payload.minOrderAmount)}</p> : null}
            <Alert tone="warning">لا يمكن تعديل الكود بعد حفظه. لأي تغيير أنشئي كودًا جديدًا.</Alert>
          </div>
        ) : null}
      </AdminConfirmModal>
    </div>
  );
}
