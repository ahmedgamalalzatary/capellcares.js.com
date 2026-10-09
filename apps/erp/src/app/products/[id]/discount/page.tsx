"use client";

import { use, useEffect, useMemo, useState } from "react";
import { getEffectiveVariantPrice, type ProductVariant } from "@capella/shared";
import { Ruler } from "lucide-react";
import { notFound, useRouter } from "next/navigation";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { EditorLayout } from "@/components/admin/editor-layout";
import { AdminShell } from "@/components/shell/admin-shell";
import { Alert } from "@/components/ui/alert";
import { Swatch } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, InputWithAddon, Select } from "@/components/ui/input";
import { FormSkeleton } from "@/components/ui/skeleton";
import { SwitchField } from "@/components/ui/switch";
import { formatMoney, formatNumber } from "@/lib/format";
import { canReadErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { api } from "@/lib/api/client";
import { getStore, useStore } from "@/lib/store";

type VariantDiscountState = NonNullable<ProductVariant["discount"]>;

function toDateTimeLocal(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
      <AdminShell title="خصومات المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خصم" }]}>
        <FormSkeleton />
      </AdminShell>
    );
  }

  if (error && !product) {
    return (
      <AdminShell title="تعذر تحميل المنتج" crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خطأ" }]}>
        <Alert tone="danger" title="تعذر تحميل بيانات المنتج">{error}</Alert>
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
      await getStore().refetch();
      router.push("/products");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "تعذر حفظ الخصومات.");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = variants.filter((variant) => variant.discount?.status === "active").length;

  return (
    <AdminShell
      title={title}
      description="خصم مستقل لكل مقاس، بفترة بداية ونهاية."
      crumbs={[{ label: "المنتجات", href: "/products" }, { label: "خصم" }]}
    >
      {variants.length === 0 ? (
        <Card>
          <EmptyState icon={<Ruler />} title="لا توجد مقاسات لهذا المنتج" description="أضيفي مقاسًا من صفحة تعديل المنتج أولًا، ثم عودي لتحديد الخصم." />
        </Card>
      ) : (
        <EditorLayout
          notice={
            hasInvalidDiscount || saveError ? (
              <div className="grid gap-2">
                {hasInvalidDiscount ? (
                  <Alert tone="warning" title="راجعي بيانات الخصم">
                    لكل خصم: وقت بداية قبل وقت النهاية، وقيمة أكبر من صفر لا تتجاوز 100% ولا تُنزل السعر إلى صفر أو أقل.
                  </Alert>
                ) : null}
                {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
              </div>
            ) : null
          }
          status={
            <span className="flex items-center gap-2">
              <Swatch tone={activeCount > 0 ? "success" : "neutral"} />
              <span>
                خصم مفعّل على <span className="num">{formatNumber(activeCount)}</span> من <span className="num">{formatNumber(variants.length)}</span> {variants.length === 1 ? "مقاس" : "مقاسات"}
              </span>
            </span>
          }
          actions={
            <>
              <Button variant="ghost" onClick={() => router.push("/products")}>إلغاء</Button>
              <Button variant="primary" onClick={() => void save()} disabled={saving || hasInvalidDiscount}>
                {saving ? "جارٍ الحفظ…" : "حفظ الخصومات"}
              </Button>
            </>
          }
          main={variants.map((variant) => {
            const discount = buildDiscountState(variant);
            const isActive = discount.status === "active";
            const effectivePrice = variant.discount ? getEffectiveVariantPrice(variant) : variant.price;
            const discounted = isActive && effectivePrice < variant.price;
            return (
              <Card key={variant.id}>
                <CardHeader
                  title={variant.size || "بدون مقاس"}
                  description={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {discounted ? (
                        <>
                          <span className="num text-text-muted line-through">{formatMoney(variant.price)}</span>
                          <span className="num font-medium text-nude-strong">{formatMoney(effectivePrice)}</span>
                        </>
                      ) : (
                        <span className="num">{formatMoney(variant.price)}</span>
                      )}
                      <span aria-hidden>·</span>
                      <span>
                        المخزون <span className="num">{formatNumber(variant.stock)}</span>
                      </span>
                    </span>
                  }
                />
                <CardBody className="@container">
                  <div data-testid={`discount-variant-${variant.id}`} className="grid gap-5">
                    <SwitchField
                      label="تفعيل الخصم"
                      checked={isActive}
                      onCheckedChange={(checked) => updateVariantDiscount(
                        variant.id,
                        checked
                          ? { ...discount, status: "active" }
                          : variant.discount == null
                            ? null
                            : { ...discount, status: "inactive" }
                      )}
                    />
                    <div className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
                      <Field label="نوع الخصم" htmlFor={`discount-type-${variant.id}`}>
                        <Select
                          id={`discount-type-${variant.id}`}
                          value={discount.type}
                          onChange={(e) => updateVariantDiscount(variant.id, { ...discount, type: e.target.value as VariantDiscountState["type"] })}
                        >
                          <option value="percentage">نسبة مئوية</option>
                          <option value="fixed">مبلغ ثابت</option>
                        </Select>
                      </Field>
                      <Field label="قيمة الخصم" htmlFor={`discount-value-${variant.id}`}>
                        <InputWithAddon
                          id={`discount-value-${variant.id}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          className="num"
                          addon={discount.type === "percentage" ? "%" : "ج.م"}
                          value={discount.value}
                          onChange={(e) => updateVariantDiscount(variant.id, { ...discount, value: Number(e.target.value) })}
                        />
                      </Field>
                      <Field label="يبدأ في" htmlFor={`discount-start-${variant.id}`}>
                        <Input
                          id={`discount-start-${variant.id}`}
                          type="datetime-local"
                          dir="ltr"
                          className="num"
                          value={toDateTimeLocal(discount.startsAt)}
                          onChange={(e) => updateVariantDiscount(variant.id, { ...discount, startsAt: toIsoOrEmpty(e.target.value) })}
                        />
                      </Field>
                      <Field label="ينتهي في" htmlFor={`discount-end-${variant.id}`}>
                        <Input
                          id={`discount-end-${variant.id}`}
                          type="datetime-local"
                          dir="ltr"
                          className="num"
                          value={toDateTimeLocal(discount.endsAt)}
                          onChange={(e) => updateVariantDiscount(variant.id, { ...discount, endsAt: toIsoOrEmpty(e.target.value) })}
                        />
                      </Field>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        />
      )}
    </AdminShell>
  );
}
