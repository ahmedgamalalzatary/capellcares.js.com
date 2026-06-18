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
import { useCollapsedShopMedia } from "@/hooks/use-collapsed-shop-media";
import { useCollapsedShopMediaItems } from "@/hooks/use-collapsed-shop-media-items";
import type { ShopMediaSection, ShopMediaTargetType } from "@capella/shared";

type EditableItem = {
  id: string;
  imagePath: string;
  mobileImagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
};

type EditableSection = {
  slot: 1 | 2 | 3 | 4;
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

const slotPositionLabel: Record<1 | 2 | 3 | 4, string> = {
  1: "يظهر أعلى صفحة المتجر",
  2: "يظهر فوق قسم المجموعات",
  3: "يظهر فوق المنتجات المميزة",
  4: "يظهر أسفل قسم الأكثر مبيعًا"
};

function toEditableSection(section: ShopMediaSection | undefined, slot: 1 | 2 | 3 | 4): EditableSection {
  return {
    slot,
    status: section?.status ?? "inactive",
    items: (section?.items ?? []).map((item) => ({
      id: String(item.id),
      imagePath: item.imagePath ?? "",
      mobileImagePath: item.mobileImagePath ?? "",
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
  const [savingSlot, setSavingSlot] = useState<1 | 2 | 3 | 4 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtySlotsRef = useRef<Set<1 | 2 | 3 | 4>>(new Set());
  const [dirtySlots, setDirtySlots] = useState<Set<1 | 2 | 3 | 4>>(new Set());
  const { collapsed: collapsedSlots, toggle: toggleCollapsed } = useCollapsedShopMedia();
  const { collapsed: collapsedItems, toggle: toggleCollapsedItem } = useCollapsedShopMediaItems();

  useEffect(() => {
    const bySlot = new Map(shopMediaSections.map((section) => [section.slot, section] as const));
    setSections((current) => ([1, 2, 3, 4] as const).map((slot) => {
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

  const setSection = (slot: 1 | 2 | 3 | 4, updater: (current: EditableSection) => EditableSection) => {
    dirtySlotsRef.current.add(slot);
    setDirtySlots(new Set(dirtySlotsRef.current));
    setSections((current) => current.map((section) => section.slot === slot ? updater(section) : section));
  };

  const saveSection = async (section: EditableSection) => {
    if (section.items.some((item) => (!item.imagePath && !item.mobileImagePath) || (isDetailTargetType(item.targetType) && item.targetId === null))) {
      const validationError = new Error("أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.");
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
          imagePath: item.imagePath || null,
          mobileImagePath: item.mobileImagePath || null,
          targetType: item.targetType,
          targetId: isDetailTargetType(item.targetType) ? item.targetId : null,
          sortOrder: index + 1
        }))
      });
      dirtySlotsRef.current.delete(section.slot);
      setDirtySlots(new Set(dirtySlotsRef.current));
      toast.success("تم حفظ القسم بنجاح.");
    } catch {
      const saveError = new Error("تعذر حفظ القسم. حاولي مرة أخرى.");
      setError(saveError.message);
      showErrorToast(saveError, saveError.message);
    } finally {
      setSavingSlot(null);
    }
  };

  const addItem = (slot: 1 | 2 | 3 | 4) => setSection(slot, (current) => ({
    ...current,
    items: [
      ...current.items,
      {
        id: `new-${slot}-${current.items.length + 1}`,
        imagePath: "",
        mobileImagePath: "",
        targetType: "offers",
        targetId: null
      }
    ]
  }));

  return (
    <AdminShell title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]}>
      <div className="form-stack">
        {sections.map((section) => {
          const isActive = section.status === "active";
          const isDirty = dirtySlots.has(section.slot);
          const isSaving = savingSlot === section.slot;
          const isCollapsed = collapsedSlots.has(section.slot);
          return (
            <div key={section.slot} className="card">
              <div className="shop-media-head">
                <div className="shop-media-head__main-flex">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => toggleCollapsed(section.slot)}
                    aria-label={isCollapsed ? "توسيع القسم" : "طي القسم"}
                    aria-expanded={!isCollapsed}
                  >
                    <Icon.Chevron size={14} className={isCollapsed ? "rotate-180" : undefined} />
                  </button>
                  <h3 className="card__title">القسم {section.slot}</h3>
                  <span className="shop-media-head__sub">{slotPositionLabel[section.slot]}</span>
                </div>
                <div className="shop-media-head__tools">
                  <span className="tag">{section.items.length} صورة</span>
                  {canEdit ? (
                    <label className="switch">
                      <input
                        type="checkbox"
                        aria-label="تفعيل القسم"
                        checked={isActive}
                        onChange={() => setSection(section.slot, (current) => ({
                          ...current,
                          status: current.status === "active" ? "inactive" : "active"
                        }))}
                      />
                      <span className="switch__track" />
                      <span className="switch__text">
                        <span className="switch__title">{isActive ? "نشط" : "غير نشط"}</span>
                      </span>
                    </label>
                  ) : (
                    <span className={`status ${isActive ? "status--active" : "status--inactive"}`}>
                      {isActive ? "نشط" : "غير نشط"}
                    </span>
                  )}
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!isDirty || isSaving}
                        onClick={() => { void saveSection(section); }}
                      >
                        {isSaving ? "جارٍ الحفظ…" : "حفظ القسم"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="card__body form-stack" hidden={isCollapsed}>
                {section.items.length === 0 ? (
                  <div className="shop-media-empty">
                    <div className="shop-media-empty__icon"><Icon.Plus /></div>
                    <div>لا توجد صور في هذا القسم بعد.</div>
                    {canEdit ? (
                      <button type="button" className="btn btn--soft btn--sm" onClick={() => addItem(section.slot)}>
                        <Icon.Plus /> أضيفي أول صورة
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="table-outer">
                      <table className="table shop-media-table">
                        <thead>
                          <tr>
                            <th style={{ width: 56 }}>#</th>
                            <th style={{ width: 320 }}>الصور</th>
                            <th>نوع الوجهة</th>
                            <th>العنصر / الرابط</th>
                            {canEdit ? <th style={{ width: 80 }} aria-label="إجراءات" /> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map((item, index) => {
                            const detailOptions = isDetailTargetType(item.targetType)
                              ? targetOptionsByType[item.targetType]
                              : [];
                            const isDetail = isDetailTargetType(item.targetType);
                            const itemKey = `${section.slot}:${item.id}`;
                            const isItemCollapsed = collapsedItems.has(itemKey);
                            const typeLabel = [...listingTargetOptions, ...detailTargetOptions]
                              .find((option) => option.value === item.targetType)?.label ?? item.targetType;
                            const targetSummary = isDetail
                              ? (detailOptions.find((option) => option.id === item.targetId)?.label ?? "— بدون عنصر")
                              : typeLabel;

                            const foldButton = (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => toggleCollapsedItem(itemKey)}
                                aria-label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"}
                                aria-expanded={!isItemCollapsed}
                              >
                                <Icon.Chevron size={14} className={isItemCollapsed ? "rotate-180" : undefined} />
                              </button>
                            );

                            if (isItemCollapsed) {
                              return (
                                <tr key={item.id}>
                                  <td>
                                    <span className="row" style={{ gap: 6, alignItems: "center" }}>
                                      {foldButton}
                                      <span className="shop-media-tile__index">{index + 1}</span>
                                    </span>
                                  </td>
                                  <td colSpan={3}>
                                    <span className="faint">{typeLabel} · {targetSummary}</span>
                                  </td>
                                  {canEdit ? (
                                    <td>
                                      <button
                                        type="button"
                                        className="btn btn--ghost btn--sm"
                                        onClick={() => setSection(section.slot, (current) => ({
                                          ...current,
                                          items: current.items.filter((entry) => entry.id !== item.id)
                                        }))}
                                      >
                                        <Icon.Trash size={14} /> إزالة
                                      </button>
                                    </td>
                                  ) : null}
                                </tr>
                              );
                            }

                            return (
                              <tr key={item.id}>
                                <td>
                                  <span className="row" style={{ gap: 6, alignItems: "center" }}>
                                    {foldButton}
                                    <span className="shop-media-tile__index">{index + 1}</span>
                                  </span>
                                </td>
                                <td>
                                  <ImageUpload
                                    label="صورة سطح المكتب"
                                    value={item.imagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, imagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                  <div style={{ height: 10 }} />
                                  <ImageUpload
                                    label="صورة الموبايل"
                                    value={item.mobileImagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, mobileImagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                </td>
                                <td>
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
                                </td>
                                <td>
                                  {isDetail ? (
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
                                  ) : (
                                    <span className="faint">صفحة قائمة — بدون عنصر محدد</span>
                                  )}
                                </td>
                                {canEdit ? (
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => setSection(section.slot, (current) => ({
                                        ...current,
                                        items: current.items.filter((entry) => entry.id !== item.id)
                                      }))}
                                    >
                                      <Icon.Trash size={14} /> إزالة
                                    </button>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {canEdit ? (
                      <div>
                        <button type="button" className="btn btn--ghost btn--sm" style={{ margin: " 40px 20px" }} onClick={() => addItem(section.slot)}>
                          <Icon.Plus /> إضافة صورة
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {error ? <p style={{ margin: 0, color: "var(--error)" }}>{error}</p> : null}
      </div>
    </AdminShell>
  );
}
