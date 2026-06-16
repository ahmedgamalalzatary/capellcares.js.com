"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { ImageUpload } from "@/components/forms/image-upload";
import { Icon } from "@/components/ui/icons";
import { showErrorToast } from "@/lib/errors";
import { getStore, useStore } from "@/lib/store";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import type { ShopMediaSection, ShopMediaTargetType } from "@capella/shared";

type EditableItem = {
  id: string;
  imagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
};

type EditableSection = {
  slot: 1 | 2 | 3;
  status: "active" | "inactive";
  items: EditableItem[];
};

const listingTargetOptions: Array<{ value: ShopMediaTargetType; label: string }> = [
  { value: "shop", label: "صفحة المتجر" },
  { value: "new", label: "وصل حديثًا" },
  { value: "bestsellers", label: "الأكثر مبيعًا" },
  { value: "products", label: "كل المنتجات" },
  { value: "offers", label: "كل العروض" },
  { value: "collections", label: "كل المجموعات" }
];

const detailTargetOptions: Array<{ value: ShopMediaTargetType; label: string }> = [
  { value: "product", label: "منتج" },
  { value: "offer", label: "عرض" },
  { value: "collection", label: "مجموعة" },
  { value: "category", label: "قسم" }
];

function toEditableSection(section: ShopMediaSection | undefined, slot: 1 | 2 | 3): EditableSection {
  return {
    slot,
    status: section?.status ?? "inactive",
    items: (section?.items ?? []).map((item) => ({
      id: String(item.id),
      imagePath: item.imagePath,
      targetType: item.targetType,
      targetId: item.targetId
    }))
  };
}

function isDetailTargetType(targetType: ShopMediaTargetType) {
  return targetType === "product" || targetType === "offer" || targetType === "collection" || targetType === "category";
}

export default function ShopMediaPage() {
  const { user } = useAdminAuth();
  const shopMediaSections = useStore((store) => store.shopMediaSections);
  const products = useStore((store) => store.products);
  const categories = useStore((store) => store.categories);
  const offers = useStore((store) => store.offers);
  const collections = useStore((store) => store.collections);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [savingSlot, setSavingSlot] = useState<1 | 2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtySlotsRef = useRef<Set<1 | 2 | 3>>(new Set());

  useEffect(() => {
    const bySlot = new Map(shopMediaSections.map((section) => [section.slot, section] as const));
    setSections((current) => [1, 2, 3].map((slot) => {
      const currentSection = current.find((section) => section.slot === slot);
      if (currentSection && dirtySlotsRef.current.has(slot)) {
        return currentSection;
      }
      return toEditableSection(bySlot.get(slot), slot);
    }));
  }, [shopMediaSections]);

  const targetOptionsByType = useMemo(() => ({
    product: products.map((product) => ({ id: product.id, label: product.name.ar })),
    offer: offers.map((offer) => ({ id: offer.id, label: offer.name.ar })),
    collection: collections.map((collection) => ({ id: collection.id, label: collection.name.ar })),
    category: categories.map((category) => ({ id: category.id, label: category.name.ar }))
  }), [categories, collections, offers, products]);

  if (!canReadErpModule(user, "shop_media")) {
    return (
      <AdminShell title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى وسائط المتجر." />
      </AdminShell>
    );
  }

  const canEdit = canUpdateErpModule(user, "shop_media");

  const setSection = (slot: 1 | 2 | 3, updater: (current: EditableSection) => EditableSection) => {
    dirtySlotsRef.current.add(slot);
    setSections((current) => current.map((section) => section.slot === slot ? updater(section) : section));
  };

  const saveSection = async (section: EditableSection) => {
    if (section.items.some((item) => !item.imagePath || (isDetailTargetType(item.targetType) && item.targetId === null))) {
      const validationError = new Error("أكملي الصورة والوجهة لكل عنصر قبل الحفظ.");
      const validationError = new Error("أكملي الصورة والوجهة لكل عنصر قبل الحفظ.");
      setError(validationError.message);
      showErrorToast(validationError, validationError.message);
      return;
    }

    try {
      setSavingSlot(section.slot);
      setError(null);
      await getStore().updateShopMediaSection(section.slot, {
        status: section.status,
        items: section.items.map((item, index) => ({
          imagePath: item.imagePath,
          targetType: item.targetType,
          targetId: isDetailTargetType(item.targetType) ? item.targetId : null,
          sortOrder: index + 1
        }))
      });
      dirtySlotsRef.current.delete(section.slot);
      toast.success("تم حفظ القسم بنجاح.");
    } catch {
      const saveError = new Error("تعذر حفظ القسم. حاولي مرة أخرى.");
      setError(saveError.message);
      showErrorToast(saveError, saveError.message);
    } finally {
      setSavingSlot(null);
    }
  };

  return (
    <AdminShell title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]}>
      <div className="form-stack">
        {sections.map((section) => (
          <div key={section.slot} className="card">
            <div className="card__head">
              <h3 className="card__title">القسم {section.slot}</h3>
            </div>
            <div className="card__body form-stack">
              <div className="field">
                <label htmlFor={`section-status-${section.slot}`}>الحالة</label>
                <select
                  id={`section-status-${section.slot}`}
                  className="select"
                  value={section.status}
                  onChange={(event) => setSection(section.slot, (current) => ({ ...current, status: event.target.value as "active" | "inactive" }))}
                  disabled={!canEdit}
                >
                  <option value="inactive">غير نشط</option>
                  <option value="active">نشط</option>
                </select>
              </div>

              <div className="form-stack">
                {section.items.map((item, index) => {
                  const detailOptions = isDetailTargetType(item.targetType)
                    ? targetOptionsByType[item.targetType]
                    : [];

                  return (
                    <div key={item.id} className="card" style={{ background: "var(--surface)" }}>
                      <div className="card__body form-stack">
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <strong>صورة {index + 1}</strong>
                          {canEdit ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setSection(section.slot, (current) => ({
                                ...current,
                                items: current.items.filter((entry) => entry.id !== item.id)
                              }))}
                            >
                              <Icon.Trash /> إزالة
                            </button>
                          ) : null}
                        </div>

                        <ImageUpload
                          value={item.imagePath || null}
                          onChange={(value) => setSection(section.slot, (current) => ({
                            ...current,
                            items: current.items.map((entry) => entry.id === item.id ? { ...entry, imagePath: value ?? "" } : entry)
                          }))}
                          uploadContext="shop_media.update"
                        />

                        <div className="editor-fields-2">
                          <div className="field">
                            <label htmlFor={`target-type-${section.slot}-${item.id}`}>نوع الوجهة</label>
                            <select
                              id={`target-type-${section.slot}-${item.id}`}
                              className="select"
                              value={item.targetType}
                              onChange={(event) => {
                                const nextType = event.target.value as ShopMediaTargetType;
                                setSection(section.slot, (current) => ({
                                  ...current,
                                  items: current.items.map((entry) => entry.id === item.id ? {
                                    ...entry,
                                    targetType: nextType,
                                    targetId: isDetailTargetType(nextType) ? entry.targetId : null
                                  } : entry)
                                }));
                              }}
                              disabled={!canEdit}
                            >
                              {listingTargetOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                              {detailTargetOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          {isDetailTargetType(item.targetType) ? (
                            <div className="field">
                              <label htmlFor={`target-id-${section.slot}-${item.id}`}>العنصر</label>
                              <select
                                id={`target-id-${section.slot}-${item.id}`}
                                className="select"
                                value={item.targetId ?? ""}
                                onChange={(event) => setSection(section.slot, (current) => ({
                                  ...current,
                                  items: current.items.map((entry) => entry.id === item.id ? {
                                    ...entry,
                                    targetId: event.target.value ? Number(event.target.value) : null
                                  } : entry)
                                }))}
                                disabled={!canEdit}
                              >
                                <option value="">اختاري عنصرًا</option>
                                {detailOptions.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSection(section.slot, (current) => ({
                      ...current,
                      items: [
                        ...current.items,
                        {
                          id: `new-${section.slot}-${current.items.length + 1}`,
                          imagePath: "",
                          targetType: "offers",
                          targetId: null
                        }
                      ]
                    }))}
                  >
                    <Icon.Plus /> إضافة صورة
                  </button>
                ) : null}
              </div>

              {canEdit ? (
                <div className="editor-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => { void saveSection(section); }}
                    disabled={savingSlot === section.slot}
                  >
                    {savingSlot === section.slot ? "جارٍ الحفظ…" : "حفظ القسم"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {error ? <p style={{ margin: 0, color: "var(--error)" }}>{error}</p> : null}
      </div>
    </AdminShell>
  );
}
