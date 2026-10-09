"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
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
  const { user } = useAdminAuth();
  const products = useStore((state) => state.products);
  const offers = useStore((state) => state.offers);
  const collections = useStore((state) => state.collections);
  const categories = useStore((state) => state.categories);
  const loaded = useStore((state) => state.loaded);
  const loadError = useStore((state) => state.error);
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
  const canSave = included.length > 0 && value > 0 && Number.isFinite(value) && (type !== "percentage" || value <= 100) && validDates && invalidFixed.length === 0 && !invalidZero && !saving;

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
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.post("/api/erp/discounts/bulk", {
        ...selectionPayload(),
        discount: { type, value, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), status: "active" }
      });
      await getStore().refetch();
      toast.success("تم تطبيق الخصم على العناصر المختارة.");
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

  return (
    <AdminShell
      title="إدارة الخصومات"
      description="اختاري منتجات أو أقسامًا أو عروضًا أو مجموعات وطبّقي خصمًا واحدًا عليها."
      crumbs={[{ label: "المنتجات", href: "/products" }, { label: "إدارة الخصومات" }]}
    >
      {!loaded ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Skeleton className="h-72 rounded-well" />
          <Skeleton className="h-72 rounded-well" />
        </div>
      ) : loadError ? (
        <Alert tone="danger" title="تعذر تحميل العناصر">{loadError}</Alert>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="grid gap-5">
            <SelectionGroup title="الأقسام" prefix="قسم" items={categoryOptions.map((option) => ({ id: option.id, label: option.label, depth: option.depth }))} selected={categoryIds} onToggle={(id) => setCategoryIds((current) => toggleId(current, id))} />
            <SelectionGroup title="المنتجات" prefix="منتج" items={products.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={productIds} onToggle={(id) => setProductIds((current) => toggleId(current, id))} />
            <SelectionGroup title="العروض" prefix="عرض" items={offers.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={offerIds} onToggle={(id) => setOfferIds((current) => toggleId(current, id))} />
            <SelectionGroup title="المجموعات" prefix="مجموعة" items={collections.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={collectionIds} onToggle={(id) => setCollectionIds((current) => toggleId(current, id))} />
          </div>

          <div className="grid gap-5">
            <Card>
              <CardHeader title="بيانات الخصم" />
              <CardBody className="@container">
                <div className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
                  <Field label="نوع الخصم" htmlFor="bulk-discount-type">
                    <Select id="bulk-discount-type" value={type} onChange={(event) => setType(event.target.value as "percentage" | "fixed")}>
                      <option value="percentage">نسبة مئوية</option>
                      <option value="fixed">مبلغ ثابت</option>
                    </Select>
                  </Field>
                  <Field label="قيمة الخصم" htmlFor="bulk-discount-value">
                    <InputWithAddon
                      id="bulk-discount-value"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={type === "percentage" ? 100 : undefined}
                      className="num"
                      addon={type === "percentage" ? "%" : "ج.م"}
                      value={value}
                      onChange={(event) => setValue(Number(event.target.value))}
                    />
                  </Field>
                  <Field label="بداية الخصم" htmlFor="bulk-discount-start">
                    <Input id="bulk-discount-start" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                  </Field>
                  <Field label="نهاية الخصم" htmlFor="bulk-discount-end">
                    <Input id="bulk-discount-end" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                  </Field>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="مراجعة العناصر" description={`${formatNumber(included.length)} عنصر مستهدف`} />
              <CardBody className="grid gap-3">
                {targets.length === 0 ? (
                  <p className="text-sm text-text-muted">اختاري قسمًا أو عنصرًا لعرض الأسعار قبل التطبيق.</p>
                ) : (
                  <div className="grid max-h-[28rem] overflow-y-auto rounded-well shadow-[inset_0_0_0_1px_var(--line)]">
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

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "جارٍ التطبيق…" : "تطبيق الخصم"}</Button>
                  <Button variant="ghost" onClick={() => setConfirmRemove(true)} disabled={included.length === 0 || saving}>إزالة الخصومات</Button>
                </div>
              </CardBody>
            </Card>
          </div>
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
    <Card>
      <CardHeader title={title} description={`${formatNumber(selected.length)} مختار`} />
      <CardBody className="grid gap-3">
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
              <label key={item.id} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2.5 transition-colors hover:bg-sunken pointer-coarse:min-h-11">
                <input type="checkbox" className="size-4 shrink-0" aria-label={`${prefix}: ${item.label}`} checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
                <span className="min-w-0 truncate text-base text-text" style={{ paddingInlineStart: `${(item.depth ?? 0) * 14}px` }}>{item.label}</span>
              </label>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}
