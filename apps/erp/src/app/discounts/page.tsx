"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatPrice } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { api } from "@/lib/api/client";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getErrorMessage } from "@/lib/errors";
import { getStore, useStore } from "@/lib/store";
import "./discounts.css";

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
    return <AdminShell title="إدارة الخصومات"><ErpForbiddenState message="لا تملكين صلاحية إدارة الخصومات." /></AdminShell>;
  }

  return <AdminShell title="إدارة الخصومات" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "إدارة الخصومات" }]}>
    {!loaded ? <div className="card card__body">جاري تحميل العناصر...</div> : loadError ? <div className="card card__body field-error">{loadError}</div> : <div className="discounts-layout">
      <div className="discounts-selection stack">
        <div className="card card__body"><h2 className="card__title">اختاري العناصر</h2><p className="muted">يمكنك جمع منتجات وأقسام وعروض ومجموعات في خصم واحد. اختيار القسم يشمل العناصر داخله وأقسامه الفرعية.</p></div>
        <SelectionGroup title="الأقسام" prefix="قسم" items={categoryOptions.map((option) => ({ id: option.id, label: option.label, depth: option.depth }))} selected={categoryIds} onToggle={(id) => setCategoryIds((current) => toggleId(current, id))} />
        <SelectionGroup title="المنتجات" prefix="منتج" items={products.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: `${item.name.ar} (${item.sku})` }))} selected={productIds} onToggle={(id) => setProductIds((current) => toggleId(current, id))} />
        <SelectionGroup title="العروض" prefix="عرض" items={offers.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={offerIds} onToggle={(id) => setOfferIds((current) => toggleId(current, id))} />
        <SelectionGroup title="المجموعات" prefix="مجموعة" items={collections.filter((item) => !item.deletedAt).map((item) => ({ id: item.id, label: item.name.ar }))} selected={collectionIds} onToggle={(id) => setCollectionIds((current) => toggleId(current, id))} />
      </div>
      <div className="discounts-editor stack">
        <section className="card card__body stack"><h2 className="card__title">بيانات الخصم</h2><div className="editor-fields-2">
          <div className="field"><label htmlFor="bulk-discount-type">نوع الخصم</label><select id="bulk-discount-type" className="select" value={type} onChange={(event) => setType(event.target.value as "percentage" | "fixed")}><option value="percentage">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></div>
          <div className="field"><label htmlFor="bulk-discount-value">قيمة الخصم</label><input id="bulk-discount-value" className="input" type="number" min="0" max={type === "percentage" ? 100 : undefined} value={value} onChange={(event) => setValue(Number(event.target.value))} /></div>
          <div className="field"><label htmlFor="bulk-discount-start">بداية الخصم</label><input id="bulk-discount-start" className="input" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div>
          <div className="field"><label htmlFor="bulk-discount-end">نهاية الخصم</label><input id="bulk-discount-end" className="input" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></div>
        </div></section>
        <section className="card card__body stack" aria-label="مراجعة العناصر">
          <div className="row row--between"><h2 className="card__title">مراجعة العناصر</h2><strong>{included.length} عناصر مستهدفة</strong></div>
          {targets.length === 0 ? <p className="muted">اختاري قسمًا أو عنصرًا لعرض الأسعار قبل التطبيق.</p> : <div className="discounts-targets">
            {targets.map((target) => {
              const excluded = isExcluded(target);
              const setExcluded = target.kind === "variant" ? setExcludedVariants : target.kind === "offer" ? setExcludedOffers : setExcludedCollections;
              return <label className="discounts-target" key={`${target.kind}:${target.id}`} data-excluded={excluded}>
                <input type="checkbox" aria-label={`استبعاد ${target.label}`} checked={!excluded} onChange={() => setExcluded((current) => toggleId(current, target.id))} />
                <span className="discounts-target__name">{target.label}{target.hasDiscount ? <small>خصم موجود سيُستبدل</small> : null}</span>
                <span className="discounts-target__price">{formatPrice(target.price, "ar")} <span aria-hidden="true">←</span> {formatPrice(previewPrice(target.price, type, value), "ar")}</span>
              </label>;
            })}
          </div>}
          {invalidFixed.length > 0 ? <p className="field-error">المبلغ الثابت يساوي أو يتجاوز سعر {invalidFixed.length} من العناصر المختارة.</p> : null}
          {invalidZero ? <p className="field-error">لا يمكن تطبيق خصم على عنصر سعره صفر.</p> : null}
          {type === "percentage" && value > 100 ? <p className="field-error">النسبة لا يمكن أن تتجاوز 100%.</p> : null}
          {saveError ? <p className="field-error">{saveError}</p> : null}
          <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={!canSave}>{saving ? "جارٍ التطبيق..." : "تطبيق الخصم"}</button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmRemove(true)} disabled={included.length === 0 || saving}>إزالة الخصومات</button>
        </section>
      </div>
    </div>}
    <AdminConfirmModal open={confirmRemove} title="إزالة الخصومات" confirmLabel="تأكيد الإزالة" confirmClassName="btn btn--danger btn--sm" onClose={() => setConfirmRemove(false)} onConfirm={remove} disableCancel={saving} disableConfirm={saving}>
      <p className="modal-note">ستُزال الخصومات الحالية عن {included.length} من العناصر المختارة.</p>
    </AdminConfirmModal>
  </AdminShell>;
}

function SelectionGroup({ title, prefix, items, selected, onToggle }: {
  title: string; prefix: string; items: Array<{ id: number; label: string; depth?: number }>;
  selected: number[]; onToggle: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="card card__body stack stack--sm">
    <div className="row row--between"><h2 className="card__title">{title}</h2><span className="muted">{selected.length} مختار</span></div>
    <input className="input" type="search" aria-label={`بحث في ${title}`} placeholder={`ابحثي في ${title}`} value={search} onChange={(event) => setSearch(event.target.value)} />
    <div className="discounts-options">{visible.length === 0 ? <span className="muted">لا توجد نتائج.</span> : visible.map((item) =>
      <label key={item.id} className="discounts-option"><input type="checkbox" aria-label={`${prefix}: ${item.label}`} checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} /><span style={{ paddingInlineStart: `${(item.depth ?? 0) * 14}px` }}>{item.label}</span></label>
    )}</div>
  </section>;
}
