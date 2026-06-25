"use client";

import { use, useEffect, useMemo, useState } from "react";
import { formatPrice, getEffectiveVariantPrice, type ProductVariant } from "@capella/shared";
import { notFound, useRouter } from "next/navigation";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canReadErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { api } from "@/lib/api/client";
import { useStore } from "@/lib/store";

type VariantDiscountState = NonNullable<ProductVariant["discount"]>;

function toDateTimeLocal(value: string) {
  return value ? value.slice(0, 16) : "";
}

function toIsoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function buildDiscountState(variant: ProductVariant): VariantDiscountState {
  return variant.discount ?? {
    type: "percentage",
    value: 0,
    startsAt: "",
    endsAt: "",
    status: "inactive"
  };
}

export default function ProductDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAdminAuth();
  if (!canReadErpModule(user, "products")) {
    return (
      <AdminShell title="خصومات المنتجات" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى المنتجات." />
      </AdminShell>
    );
  }

  if (!hasErpPermission(user, "products.discount")) {
    return (
      <AdminShell title="خصومات المنتجات" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "غير مصرح" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية تعديل خصومات المنتجات." />
      </AdminShell>
    );
  }

  return <ProductDiscountPageContent params={params} />;
}

function ProductDiscountPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const products = useStore((s) => s.products);
  const loaded = useStore((s) => s.loaded);
  const error = useStore((s) => s.error);
  const product = products.find((item) => item.id === Number(id));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>(() => product?.variants ?? []);

  useEffect(() => {
    if (product) {
      setVariants(product.variants);
    }
  }, [product]);

  const title = product ? `خصم: ${product.name.ar}` : "خصومات المنتج";

  const hasInvalidDiscount = useMemo(() => {
    return variants.some((variant) => {
      const discount = variant.discount;
      if (!discount) return false;
      if (!discount.startsAt || !discount.endsAt) return true;
      if (discount.value <= 0) return true;
      if (discount.type === "percentage" && discount.value > 100) return true;
      if (discount.type === "fixed" && discount.value >= variant.price) return true;
      return new Date(discount.startsAt) >= new Date(discount.endsAt);
    });
  }, [variants]);

  if (!loaded) {
    return (
      <AdminShell title="تحميل الخصومات..." crumbs={[{ label: "المنتجات", href: "/products" }, { label: "تحميل" }]}>
        <div className="card">جاري تحميل بيانات المنتج...</div>
      </AdminShell>
    );
  }

  if (error && !product) {
    return (
      <AdminShell title="تعذر تحميل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خطأ" }]}>
        <div className="card">{error}</div>
      </AdminShell>
    );
  }

  if (!product) return notFound();

  const updateVariantDiscount = (variantId: number, discount: ProductVariant["discount"]) => {
    setVariants((current) => current.map((variant) => (
      variant.id === variantId ? { ...variant, discount } : variant
    )));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.post(`/api/erp/products/${product.id}/discount`, {
        variants: variants.map((variant) => ({
          id: variant.id,
          discount: variant.discount ?? null
        }))
      });
      router.push("/products");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "تعذر حفظ الخصومات.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title={title} crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خصم" }]}>
      <div className="card">
        <div className="card__head">
          <h3 className="card__title">خصومات المقاسات</h3>
        </div>
        <div className="card__body stack stack--lg">
          {variants.map((variant) => {
            const discount = buildDiscountState(variant);
            const isActive = discount.status === "active";
            const effectivePrice = variant.discount ? getEffectiveVariantPrice(variant) : variant.price;
            return (
              <section key={variant.id} className="card" data-testid={`discount-variant-${variant.id}`}>
                <div className="card__body stack">
                  <div className="row row--between">
                    <div>
                      <div style={{ fontWeight: 700 }}>{variant.size}</div>
                      <div className="muted">السعر الأصلي: {formatPrice(variant.price, "ar")}</div>
                      <div className="muted">المخزون: {variant.stock}</div>
                      <div className="muted">السعر بعد الخصم: {formatPrice(effectivePrice, "ar")}</div>
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => updateVariantDiscount(variant.id, { ...discount, status: e.target.checked ? "active" : "inactive" })}
                      />
                      تفعيل الخصم
                    </label>
                  </div>

                  <div className="editor-fields-2">
                    <div className="field">
                      <label htmlFor={`discount-type-${variant.id}`}>نوع الخصم</label>
                      <select
                        id={`discount-type-${variant.id}`}
                        className="select"
                        value={discount.type}
                        onChange={(e) => updateVariantDiscount(variant.id, { ...discount, type: e.target.value as VariantDiscountState["type"] })}
                      >
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`discount-value-${variant.id}`}>قيمة الخصم</label>
                      <input
                        id={`discount-value-${variant.id}`}
                        className="input"
                        type="number"
                        min="0"
                        value={discount.value}
                        onChange={(e) => updateVariantDiscount(variant.id, { ...discount, value: Number(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`discount-start-${variant.id}`}>بداية الخصم</label>
                      <input
                        id={`discount-start-${variant.id}`}
                        className="input"
                        type="datetime-local"
                        value={toDateTimeLocal(discount.startsAt)}
                        onChange={(e) => updateVariantDiscount(variant.id, { ...discount, startsAt: toIsoOrEmpty(e.target.value) })}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`discount-end-${variant.id}`}>نهاية الخصم</label>
                      <input
                        id={`discount-end-${variant.id}`}
                        className="input"
                        type="datetime-local"
                        value={toDateTimeLocal(discount.endsAt)}
                        onChange={(e) => updateVariantDiscount(variant.id, { ...discount, endsAt: toIsoOrEmpty(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

          {saveError ? <div className="field-error">{saveError}</div> : null}
          {hasInvalidDiscount ? (
            <div className="field-error">راجعي بيانات الخصم: يجب إدخال وقت بداية ونهاية صالحين، وقيمة خصم صحيحة لا تُسقط السعر للصفر أو أقل.</div>
          ) : null}
        </div>
      </div>

      <div className="save-bar">
        <div className="save-bar__hints">
          <span className="save-bar__hints-lead">هذه الصفحة مخصصة لإدارة الخصومات فقط.</span>
        </div>
        <div className="save-bar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => router.push("/products")}>إلغاء</button>
          <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={saving || hasInvalidDiscount}>
            {saving ? "جارٍ الحفظ..." : "حفظ الخصومات"}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
