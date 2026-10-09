"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { StepCount, Stepper, type StepItem } from "@/components/admin/stepper";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, InputWithAddon, InputWithIcon, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney, formatNumber } from "@/lib/format";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Target = { kind: "variant" | "offer" | "collection"; id: number; label: string; price: number; hasDiscount: boolean };

const STEPS = [
  { id: "items", label: "العناصر", title: "اختاري العناصر", description: "يمكنك جمع منتجات وأقسام وعروض ومجموعات في خصم واحد." },
  { id: "details", label: "بيانات الخصم", title: "بيانات الخصم", description: "نوع الخصم وقيمته وفترة تطبيقه." },
  { id: "review", label: "المراجعة والتطبيق", title: "مراجعة العناصر والتطبيق", description: "راجعي العناصر المستهدفة ثم طبّقي الخصم." }
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FIELD_GRID = "grid gap-x-4 gap-y-5 @lg:grid-cols-2";

function inCategory(categoryId: number, selected: Set<number>, parents: Map<number, number | null>) {
  let current: number | null | undefined = categoryId;
  const seen = new Set<number>();
  while (current != null && !seen.has(current)) {
    if (selected.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

function toggleId(current: number[], id: number) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function previewPrice(price: number, type: "percentage" | "fixed", value: number) {
  if (!Number.isFinite(value) || value <= 0) return price;
  return Math.max(0, Number((type === "percentage" ? price * (1 - value / 100) : price - value).toFixed(2)));
}

export default function DiscountsPage() {
  const router = useRouter();
  const { user } = useAdminAuth();
  const products = useStore((state) => state.products);
  const offers = useStore((state) => state.offers);
  const collections = useStore((state) => state.collections);
  const categories = useStore((state) => state.categories);
  const loaded = useStore((state) => state.loaded);
  const loadError = useStore((state) => state.error);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [offerIds, setOfferIds] = useState<number[]>([]);
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [excludedVariants, setExcludedVariants] = useState<number[]>([]);
  const [excludedOffers, setExcludedOffers] = useState<number[]>([]);
  const [excludedCollections, setExcludedCollections] = useState<number[]>([]);
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  const targets = useMemo(() => {
    const parents = new Map(categories.map((category) => [category.id, category.parentId]));
    const selectedCategories = new Set(categoryIds);
    const selectedProducts = new Set(productIds);
    const selectedOffers = new Set(offerIds);
    const selectedCollections = new Set(collectionIds);
    const result: Target[] = [];
    for (const product of products) {
      if (product.deletedAt || (!selectedProducts.has(product.id) && !inCategory(product.categoryId, selectedCategories, parents))) continue;
      for (const variant of product.variants) {
        result.push({ kind: "variant", id: variant.id, label: `${product.name.ar} — ${variant.size}`, price: variant.price, hasDiscount: Boolean(variant.discount) });
      }
    }
    for (const offer of offers) {
      if (offer.deletedAt || (!selectedOffers.has(offer.id) && (offer.categoryId == null || !inCategory(offer.categoryId, selectedCategories, parents)))) continue;
      result.push({ kind: "offer", id: offer.id, label: offer.name.ar, price: offer.price, hasDiscount: Boolean(offer.discount) });
    }
    for (const collection of collections) {
      if (collection.deletedAt || (!selectedCollections.has(collection.id) && !inCategory(collection.categoryId, selectedCategories, parents))) continue;
      result.push({ kind: "collection", id: collection.id, label: collection.name.ar, price: collection.price, hasDiscount: Boolean(collection.discount) });
    }
    return result;
  }, [categories, categoryIds, productIds, offerIds, collectionIds, products, offers, collections]);

  const isExcluded = (target: Target) => target.kind === "variant"
    ? excludedVariants.includes(target.id)
    : target.kind === "offer" ? excludedOffers.includes(target.id) : excludedCollections.includes(target.id);
  const included = targets.filter((target) => !isExcluded(target));
  const invalidFixed = type === "fixed" ? included.filter((target) => value >= target.price) : [];
  const invalidZero = included.some((target) => target.price <= 0);
  const validDates = Boolean(startsAt && endsAt && new Date(startsAt).getTime() < new Date(endsAt).getTime());

  const requirements = [
    { key: "items", label: "اختيار عنصر واحد على الأقل", target: "items", ok: included.length > 0 },
    { key: "value", label: "قيمة خصم صحيحة", target: "details", ok: value > 0 && Number.isFinite(value) && (type !== "percentage" || value <= 100) },
    { key: "dates", label: "فترة الخصم", target: "details", ok: validDates },
    { key: "amounts", label: "مبالغ صحيحة", target: "review", ok: invalidFixed.length === 0 && !invalidZero }
  ];
  const missing = requirements.filter((requirement) => !requirement.ok);
  const canApply = missing.length === 0 && !saving;

  const stepIndex = (id: StepId) => STEPS.findIndex((candidate) => candidate.id === id);

  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((requirement) => keys.includes(requirement.key) && !requirement.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const requirement of failing) next[requirement.key] = requirement.label;
      return next;
    });
    return failing.length === 0;
  };

  const goTo = (index: number) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const keys = requirements.filter((requirement) => requirement.target === STEPS[step]!.id).map((requirement) => requirement.key);
    if (!checkRequirements(keys)) return;
    goTo(step + 1);
  };

  const selectionPayload = () => ({
    productIds, offerIds, collectionIds, categoryIds,
    excludeVariantIds: targets.filter((target) => target.kind === "variant" && isExcluded(target)).map((target) => target.id),
    excludeOfferIds: targets.filter((target) => target.kind === "offer" && isExcluded(target)).map((target) => target.id),
    excludeCollectionIds: targets.filter((target) => target.kind === "collection" && isExcluded(target)).map((target) => target.id)
  });

  const clearSelection = () => {
    setProductIds([]); setOfferIds([]); setCollectionIds([]); setCategoryIds([]);
    setExcludedVariants([]); setExcludedOffers([]); setExcludedCollections([]);
  };

  const save = async () => {
    if (!checkRequirements(["items", "value", "dates", "amounts"])) {
      goTo(!included.length ? stepIndex("items") : stepIndex("details"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await api.post("/api/erp/discounts/bulk", {
        ...selectionPayload(),
        discount: { type, value, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), status: "active" }
      });
      await getStore().refetch();
      toast.success("تم تطبيق الخصم على العناصر المختارة.");
      goTo(0);
      clearSelection();
    } catch (error) {
      setSaveError(getErrorMessage(error, "تعذر تطبيق الخصم."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving || included.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.post("/api/erp/discounts/bulk", { ...selectionPayload(), discount: null });
      await getStore().refetch();
      toast.success("تمت إزالة الخصومات عن العناصر المختارة.");
      setConfirmRemove(false);
      goTo(0);
      clearSelection();
    } catch (error) {
      setSaveError(getErrorMessage(error, "تعذر إزالة الخصومات."));
      setConfirmRemove(false);
    } finally {
      setSaving(false);
    }
  };

  if (!hasErpPermission(user, "discounts.manage")) {
    return (
      <AdminShell title="إدارة الخصومات" crumbs={[{ label: "إدارة الخصومات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية إدارة الخصومات." />
      </AdminShell>
    );
  }

  const stepItems: StepItem[] = STEPS.map((item, index) => {
    const required = requirements.filter((requirement) => requirement.target === item.id);
    const unmet = required.some((requirement) => !requirement.ok);
    const seen = index < step || index < reached;
    if (unmet) return { id: item.id, label: item.label, state: seen ? "missing" : "todo" };
    return { id: item.id, label: item.label, state: seen ? "done" : "todo" };
  });
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const stepContent: Record<StepId, ReactNode> = {
    items: (
      <div className="grid gap-5 @3xl:grid-cols-2">
        <SelectionGroup title="الأقسام" prefix="قسم" items={categoryOptions.map((option) => ({ id: option.id, label: option.label, depth: option.depth }))} selected={categoryIds} onToggle={(id) => setCategoryIds((current) => toggleId(current, id))} />
        <SelectionGroup title="المنتجات" prefix="منتج" items={products.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={productIds} onToggle={(id) => setProductIds((current) => toggleId(current, id))} />
        <SelectionGroup title="العروض" prefix="عرض" items={offers.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={offerIds} onToggle={(id) => setOfferIds((current) => toggleId(current, id))} />
        <SelectionGroup title="المجموعات" prefix="مجموعة" items={collections.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={collectionIds} onToggle={(id) => setCollectionIds((current) => toggleId(current, id))} />
      </div>
    ),
    details: (
      <div className="grid gap-5">
        <div className={FIELD_GRID}>
          <Field label="نوع الخصم" htmlFor="bulk-discount-type">
            <Select id="bulk-discount-type" value={type} onChange={(event) => setType(event.target.value as "percentage" | "fixed")}>
              <option value="percentage">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
            </Select>
          </Field>
          <Field label="قيمة الخصم" htmlFor="bulk-discount-value" error={errors.value}>
            <InputWithAddon
              id="bulk-discount-value"
              type="number"
              inputMode="decimal"
              min="0"
              max={type === "percentage" ? 100 : undefined}
              className="num"
              addon={type === "percentage" ? "%" : "ج.م"}
              aria-invalid={Boolean(errors.value) || undefined}
              value={value}
              onChange={(event) => setValue(Number(event.target.value))}
            />
          </Field>
          <Field label="بداية الخصم" htmlFor="bulk-discount-start" error={errors.dates}>
            <Input id="bulk-discount-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </Field>
          <Field label="نهاية الخصم" htmlFor="bulk-discount-end">
            <Input id="bulk-discount-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </Field>
        </div>
      </div>
    ),
    review: (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-text-2"><span className="num font-medium text-text-strong">{formatNumber(included.length)}</span> عنصر مستهدف</span>
        </div>
        {targets.length === 0 ? (
          <div className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-10 text-center text-sm text-text-muted">
            لم تختاري أي عنصر بعد. عودي إلى خطوة العناصر.
          </div>
        ) : (
          <div className="grid max-h-[30rem] overflow-y-auto rounded-well shadow-[inset_0_0_0_1px_var(--line)]">
            {targets.map((target) => {
              const excluded = isExcluded(target);
              const setExcluded = target.kind === "variant" ? setExcludedVariants : target.kind === "offer" ? setExcludedOffers : setExcludedCollections;
              return (
                <label
                  key={`${target.kind}:${target.id}`}
                  className={cn(
                    "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-3 py-2.5 transition-colors last:border-b-0 hover:bg-sunken",
                    excluded && "opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    aria-label={`استبعاد ${target.label}`}
                    checked={!excluded}
                    onChange={() => setExcluded((current) => toggleId(current, target.id))}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-base text-text-strong">{target.label}</span>
                    {target.hasDiscount ? <span className="text-xs text-warning">خصم موجود سيُستبدل</span> : null}
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-text-muted">
                    <span className="num">{formatMoney(target.price)}</span>
                    <ArrowLeft aria-hidden className="size-3.5 text-icon-faint" />
                    <span className="num text-text-2">{formatMoney(previewPrice(target.price, type, value))}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {invalidFixed.length > 0 ? <Alert tone="danger">المبلغ الثابت يساوي أو يتجاوز سعر {formatNumber(invalidFixed.length)} من العناصر المختارة.</Alert> : null}
        {invalidZero ? <Alert tone="danger">لا يمكن تطبيق خصم على عنصر سعره صفر.</Alert> : null}
        {type === "percentage" && value > 100 ? <Alert tone="danger">النسبة لا يمكن أن تتجاوز 100%.</Alert> : null}
        {!validDates && (startsAt || endsAt) ? <Alert tone="warning">تأكدي أن تاريخ النهاية بعد تاريخ البداية.</Alert> : null}
        {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
      </div>
    )
  };

  return (
    <AdminShell
      title="إدارة الخصومات"
      description="اختاري منتجات أو أقسامًا أو عروضًا أو مجموعات وطبّقي خصمًا واحدًا عليها."
      crumbs={[{ label: "المنتجات", href: "/products" }, { label: "إدارة الخصومات" }]}
    >
      {!loaded ? (
        <div className="grid gap-5">
          <Skeleton className="h-16 rounded-well" />
          <Skeleton className="h-72 rounded-well" />
        </div>
      ) : loadError ? (
        <Alert tone="danger" title="تعذر تحميل العناصر">{loadError}</Alert>
      ) : (
        <div className="grid gap-5">
          <Stepper steps={stepItems} current={step} isReachable={(index) => index <= reached} onSelect={goTo} />

          <Card>
            <CardHeader title={current.title} description={current.description} actions={<StepCount current={step} total={STEPS.length} />} />
            <CardBody className="@container">{stepContent[current.id]}</CardBody>
            <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
              <Button variant="ghost" onClick={() => router.push("/products")}>إلغاء</Button>
              <div className="ms-auto flex flex-wrap items-center gap-2">
                {step > 0 ? (
                  <Button variant="ghost" onClick={() => goTo(step - 1)}>
                    <ArrowRight /> السابق
                  </Button>
                ) : null}
                {!isLast ? (
                  <Button variant="primary" onClick={next}>
                    التالي <ArrowLeft />
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" disabled={included.length === 0 || saving} onClick={() => setConfirmRemove(true)}>إزالة الخصومات</Button>
                    <Button variant="primary" disabled={!canApply} onClick={() => { void save(); }}>
                      {saving ? "جارٍ التطبيق…" : "تطبيق الخصم"}
                    </Button>
                  </>
                )}
              </div>
            </footer>
          </Card>
        </div>
      )}

      <AdminConfirmModal
        open={confirmRemove}
        title="إزالة الخصومات"
        confirmLabel="تأكيد الإزالة"
        tone="danger"
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        disableCancel={saving}
        disableConfirm={saving}
      >
        <p>ستُزال الخصومات الحالية عن {formatNumber(included.length)} من العناصر المختارة.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}

function SelectionGroup({ title, prefix, items, selected, onToggle }: {
  title: string;
  prefix: string;
  items: Array<{ id: number; label: string; depth?: number }>;
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className="grid content-start gap-3 rounded-well bg-sunken p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-text-strong">{title}</h3>
        <Badge tone={selected.length > 0 ? "nude" : "neutral"} swatch={false}>
          <span className="num">{formatNumber(selected.length)}</span> مختار
        </Badge>
      </div>
      <InputWithIcon
        icon={<Search />}
        type="search"
        aria-label={`بحث في ${title}`}
        placeholder={`ابحثي في ${title}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div role="group" aria-label={title} className="grid max-h-56 gap-0.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-text-muted">لا توجد نتائج.</p>
        ) : (
          visible.map((item) => (
            <label key={item.id} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2.5 transition-colors hover:bg-hover pointer-coarse:min-h-11">
              <input type="checkbox" className="size-4 shrink-0" aria-label={`${prefix}: ${item.label}`} checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
              <span className="min-w-0 truncate text-base text-text" style={{ paddingInlineStart: `${(item.depth ?? 0) * 14}px` }}>{item.label}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
