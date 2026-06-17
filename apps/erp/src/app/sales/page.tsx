"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { CheckoutRequestDto } from "@capella/shared/dto";
import { toast } from "sonner";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Icon } from "@/components/ui/icons";
import { canCreateErpModule } from "@/lib/erp-permissions";
import { getStore, useStore } from "@/lib/store";

type SaleLineType = "product" | "offer" | "collection";
type SaleLine = {
  id: string;
  type: SaleLineType;
  itemKey: string;
  qty: number;
};

const emptyLine = (): SaleLine => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type: "product",
  itemKey: "",
  qty: 1
});

const initialCustomer = {
  fullName: "",
  phone: "",
  addressLine: "",
  notes: "",
  soldTotalAmount: ""
};

function parseItem(line: SaleLine): CheckoutRequestDto["items"][number] | null {
  const [, rawId] = line.itemKey.split(":");
  const itemId = Number(rawId);
  if (!Number.isInteger(itemId) || itemId <= 0 || line.qty <= 0) {
    return null;
  }
  if (line.type === "product") {
    return { type: "product", variantId: itemId, qty: line.qty };
  }
  if (line.type === "offer") {
    return { type: "offer", offerId: itemId, qty: line.qty };
  }
  return { type: "collection", collectionId: itemId, qty: line.qty };
}

export default function SalesPage() {
  const { user } = useAdminAuth();

  if (!canCreateErpModule(user, "sales")) {
    return (
      <AdminShell title="إضافة بيع" crumbs={[{ label: "المبيعات" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تسجيل بيع جديد." />
      </AdminShell>
    );
  }

  return <SalesForm />;
}

function SalesForm() {
  const products = useStore((s) => s.products);
  const offers = useStore((s) => s.offers);
  const collections = useStore((s) => s.collections);
  const [customer, setCustomer] = useState(initialCustomer);
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const itemOptions = useMemo(() => {
    const productOptions = products
      .filter((product) => product.status === "active")
      .flatMap((product) => product.variants
        .filter((variant) => variant.stock > 0)
        .map((variant) => ({
          type: "product" as const,
          key: `product:${variant.id}`,
          label: `${product.name.ar || product.name.en} / ${variant.size}`,
          price: variant.price,
          stock: variant.stock
        })));

    const offerOptions = offers
      .filter((offer) => offer.status === "active" && offer.stock > 0)
      .map((offer) => ({
        type: "offer" as const,
        key: `offer:${offer.id}`,
        label: offer.name.ar || offer.name.en,
        price: offer.price,
        stock: offer.stock
      }));

    const collectionOptions = collections
      .filter((collection) => collection.status === "active" && collection.visibility === "visible" && collection.stock > 0)
      .map((collection) => ({
        type: "collection" as const,
        key: `collection:${collection.id}`,
        label: collection.name.ar || collection.name.en,
        price: collection.price,
        stock: collection.stock
      }));

    return {
      product: productOptions,
      offer: offerOptions,
      collection: collectionOptions,
      all: [...productOptions, ...offerOptions, ...collectionOptions]
    };
  }, [collections, offers, products]);

  const subtotal = lines.reduce((sum, line) => {
    const option = itemOptions.all.find((item) => item.key === line.itemKey);
    return sum + (option?.price ?? 0) * line.qty;
  }, 0);
  const soldTotalAmount = Number(customer.soldTotalAmount);
  const priceDelta = Number.isFinite(soldTotalAmount) ? soldTotalAmount - subtotal : null;

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = lines.map(parseItem).filter((item): item is CheckoutRequestDto["items"][number] => item != null);
    if (items.length !== lines.length) {
      toast.error("اختاري عنصرًا صحيحًا لكل بند.");
      return;
    }
    if (!Number.isFinite(soldTotalAmount)) {
      toast.error("ادخلي سعر البيع النهائي.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await getStore().createSale({
        fullName: customer.fullName,
        phone: customer.phone,
        addressLine: customer.addressLine,
        notes: customer.notes,
        soldTotalAmount,
        items
      });
      toast.success(`تم تسجيل البيع بكود ${created.orderCode}`);
      setCustomer(initialCustomer);
      setLines([emptyLine()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تسجيل البيع.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell
      title="إضافة بيع"
      crumbs={[{ label: "المبيعات" }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm"><Icon.Eye /> عرض الطلبات</Link>}
    >
      <form onSubmit={submitSale} className="stack" style={{ gap: 16 }}>
        <div className="card">
          <div className="card__head">
            <h3 className="card__title">بيانات العميل</h3>
          </div>
          <div className="card__body">
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label className="field">
                <span>اسم العميل</span>
                <input className="input" value={customer.fullName} onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })} required />
              </label>
              <label className="field">
                <span>رقم الهاتف</span>
                <input className="input" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </label>
              <label className="field">
                <span>العنوان</span>
                <input className="input" value={customer.addressLine} onChange={(e) => setCustomer({ ...customer, addressLine: e.target.value })} />
              </label>
              <label className="field">
                <span>ملاحظات</span>
                <input className="input" value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
              </label>
            </div>
          </div>
        </div>

        <div data-testid="sale-entry-layout" className="sales-entry-layout" style={{ display: "flex" }}>
          <div className="card sales-entry-layout__items">
            <div className="card__head" style={{ justifyContent: "space-between" }}>
              <h3 className="card__title">بنود البيع</h3>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setLines((current) => [...current, emptyLine()])}
              >
                <Icon.Plus /> إضافة بند
              </button>
            </div>
            <div className="card__body stack" style={{ gap: 12 }}>
              {lines.map((line, index) => {
                const options = itemOptions[line.type];
                return (
                  <div
                    key={line.id}
                    data-testid="sale-line"
                    className="sales-line"
                  >
                    <label className="field">
                      <span>نوع العنصر</span>
                      <select
                        className="select"
                        value={line.type}
                        onChange={(e) => {
                          const nextType = e.target.value as SaleLineType;
                          setLines((current) => current.map((item) => item.id === line.id ? { ...item, type: nextType, itemKey: "" } : item));
                        }}
                      >
                        <option value="product">منتج</option>
                        <option value="offer">عرض</option>
                        <option value="collection">مجموعة</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>العنصر</span>
                      <select
                        className="select"
                        value={line.itemKey}
                        onChange={(e) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, itemKey: e.target.value } : item))}
                        required
                      >
                        <option value="">اختاري العنصر</option>
                        {options.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label} - {option.price} ({option.stock} متاح)
                          </option>
                        ))}
                      </select>
                    </label>
                    <div data-testid="sale-line-qty-actions" style={{ display: "flex", gap: 8, alignItems: "end" }}>
                      <label className="field" style={{ flex: "1 1 112px" }}>
                        <span>الكمية</span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          value={line.qty}
                          onChange={(e) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, qty: Number(e.target.value) } : item))}
                          required
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        aria-label="حذف البند"
                        disabled={lines.length === 1}
                        onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                      >
                        <Icon.X />
                      </button>
                    </div>
                    {index === lines.length - 1 ? null : <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid var(--hairline)" }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card sales-entry-layout__total">
            <div className="card__body" style={{ display: "flex", alignItems: "stretch", gap: 14, justifyContent: "space-between", flexDirection: "column" }}>
              <div>
                <div data-testid="sale-total-summary" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "nowrap" }}>
                  <div className="muted">إجمالي البنود الأصلي</div>
                  <div className="page-title">{subtotal}</div>
                </div>
                {priceDelta != null && priceDelta !== 0 && customer.soldTotalAmount !== "" ? (
                  <div className="muted" style={{ marginTop: 6 }}>فرق سعر البيع: {priceDelta > 0 ? "+" : ""}{priceDelta}</div>
                ) : null}
              </div>
              <label className="field">
                <span>سعر البيع النهائي</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={customer.soldTotalAmount}
                  onChange={(e) => setCustomer({ ...customer, soldTotalAmount: e.target.value })}
                  required
                />
              </label>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                <Icon.Check /> {submitting ? "جارٍ التسجيل..." : "تسجيل البيع"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
