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
import { API_BASE } from "@/lib/api/client";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useCollapsedShopMedia } from "@/hooks/use-collapsed-shop-media";
import { useCollapsedShopMediaItems } from "@/hooks/use-collapsed-shop-media-items";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import type { ShopMediaSection, ShopMediaTargetType } from "@capella/shared";

type EditableItem = {
  id: string;
  arImagePath: string;
  arMobileImagePath: string;
  enImagePath: string;
  enMobileImagePath: string;
  targetType: ShopMediaTargetType;
  targetId: number | null;
};

type EditableSection = {
  slot: 1 | 2 | 3 | 4 | 5;
  status: "active" | "inactive";
  items: EditableItem[];
};

const SHOP_MEDIA_SLOTS = [1, 2, 3, 4, 5] as const;

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

const slotPositionLabel: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "يظهر أعلى صفحة المتجر",
  2: "يظهر فوق قسم المجموعات",
  3: "يظهر فوق المنتجات المميزة",
  4: "يظهر أسفل قسم الأكثر مبيعًا",
  5: "يظهر أسفل قسم وصل حديثًا"
};

function toEditableSection(section: ShopMediaSection | undefined, slot: 1 | 2 | 3 | 4 | 5): EditableSection {
  return {
    slot,
    status: section?.status ?? "inactive",
    items: (section?.items ?? []).map((item) => ({
      id: String(item.id),
      arImagePath: item.arImagePath ?? "",
      arMobileImagePath: item.arMobileImagePath ?? "",
      enImagePath: item.enImagePath ?? "",
      enMobileImagePath: item.enMobileImagePath ?? "",
      targetType: item.targetType,
      targetId: item.targetId
    }))
  };
}

function isDetailTargetType(targetType: ShopMediaTargetType) {
  return targetType === "product" || targetType === "offer" || targetType === "collection" || targetType === "category";
}

function resolvePreviewSrc(value: string) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API_BASE}${value}`;
  return value;
}

export default function ShopMediaPage() {
  const { user } = useAdminAuth();
  const shopMediaSections = useStore((store) => store.shopMediaSections);
  const products = useStore((store) => store.products);
  const categories = useStore((store) => store.categories);
  const offers = useStore((store) => store.offers);
  const collections = useStore((store) => store.collections);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [savingSlot, setSavingSlot] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtySlotsRef = useRef<Set<1 | 2 | 3 | 4 | 5>>(new Set());
  const [dirtySlots, setDirtySlots] = useState<Set<1 | 2 | 3 | 4 | 5>>(new Set());
  const { collapsed: collapsedSlots, toggle: toggleCollapsed } = useCollapsedShopMedia();
  const { collapsed: collapsedItems, toggle: toggleCollapsedItem } = useCollapsedShopMediaItems();

  useEffect(() => {
    const bySlot = new Map(shopMediaSections.map((section) => [section.slot, section] as const));
    setSections((current) => SHOP_MEDIA_SLOTS.map((slot) => {
      const currentSection = current.find((section) => section.slot === slot);
      if (currentSection && dirtySlotsRef.current.has(slot)) {
        return currentSection;
      }
      return toEditableSection(bySlot.get(slot), slot);
    }));
  }, [shopMediaSections]);

  // Soft-deleted entities still live in the store (the trash page reads them from
  // these same slices), so every target picker has to exclude them itself.
  const targetOptionsByType = useMemo(() => ({
    product: products.filter((product) => !product.deletedAt).map((product) => ({ id: product.id, label: product.name.ar, depth: 0 })),
    offer: offers.filter((offer) => !offer.deletedAt).map((offer) => ({ id: offer.id, label: offer.name.ar, depth: 0 })),
    collection: collections.filter((collection) => !collection.deletedAt).map((collection) => ({ id: collection.id, label: collection.name.ar, depth: 0 })),
    category: buildCategoryTreeOptions(categories)
  }), [categories, collections, offers, products]);

  if (!canReadErpModule(user, "shop_media")) {
    return (
      <AdminShell title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى وسائط المتجر." />
      </AdminShell>
    );
  }

  const canEdit = canUpdateErpModule(user, "shop_media");

  // A target deleted after the banner was set no longer resolves to an option. The
  // storefront falls back to the home page meanwhile, and the API refuses to store a
  // deleted target, so saving stays blocked until a live one is chosen.
  const hasMissingTarget = (item: EditableItem) =>
    isDetailTargetType(item.targetType)
    && item.targetId !== null
    && !targetOptionsByType[item.targetType].some((option) => option.id === item.targetId);

  const setSection = (slot: 1 | 2 | 3 | 4 | 5, updater: (current: EditableSection) => EditableSection) => {
    dirtySlotsRef.current.add(slot);
    setDirtySlots(new Set(dirtySlotsRef.current));
    setSections((current) => current.map((section) => section.slot === slot ? updater(section) : section));
  };

  const saveSection = async (section: EditableSection) => {
    if (section.items.some((item) => (
      !item.arImagePath
      && !item.arMobileImagePath
      && !item.enImagePath
      && !item.enMobileImagePath
    ) || (isDetailTargetType(item.targetType) && item.targetId === null))) {
      const validationError = new Error("أضيفي صورة واحدة على الأقل وحددي الوجهة المطلوبة لكل عنصر قبل الحفظ.");
      setError(validationError.message);
      showErrorToast(validationError, validationError.message);
      return;
    }

    if (section.items.some(hasMissingTarget)) {
      const missingTargetError = new Error("العنصر المرتبط بإحدى الصور محذوف. اختاري عنصرًا جديدًا قبل الحفظ.");
      setError(missingTargetError.message);
      showErrorToast(missingTargetError, missingTargetError.message);
      return;
    }

    try {
      setSavingSlot(section.slot);
      setError(null);
      await getStore().updateShopMediaSection(section.slot, {
        status: section.status,
        items: section.items.map((item, index) => ({
          arImagePath: item.arImagePath || null,
          arMobileImagePath: item.arMobileImagePath || null,
          enImagePath: item.enImagePath || null,
          enMobileImagePath: item.enMobileImagePath || null,
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

  const addItem = (slot: 1 | 2 | 3 | 4 | 5) => setSection(slot, (current) => ({
    ...current,
    items: [
      ...current.items,
      {
        id: `new-${slot}-${current.items.length + 1}`,
        arImagePath: "",
        arMobileImagePath: "",
        enImagePath: "",
        enMobileImagePath: "",
        targetType: "offers",
        targetId: null
      }
    ]
  }));

  const moveItem = (slot: 1 | 2 | 3 | 4 | 5, itemId: string, direction: -1 | 1) => setSection(slot, (current) => {
    const index = current.items.findIndex((entry) => entry.id === itemId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= current.items.length) {
      return current;
    }
    const items = [...current.items];
    const [moved] = items.splice(index, 1);
    items.splice(targetIndex, 0, moved);
    return { ...current, items };
  });

  return (
    <AdminShell title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]}>
      <div className="shop-media-sections">
        {sections.map((section) => {
          const isActive = section.status === "active";
          const isDirty = dirtySlots.has(section.slot);
          const isSaving = savingSlot === section.slot;
          const isCollapsed = collapsedSlots.has(section.slot);
          const previewItems = section.items
            .map((item) => resolvePreviewSrc(
              item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath
            ))
            .filter((src): src is string => Boolean(src));

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
                  <div className="shop-media-head__main">
                    <h3 className="card__title">القسم {section.slot}</h3>
                    <span className="shop-media-head__sub">{slotPositionLabel[section.slot]}</span>
                  </div>
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
                      {isDirty ? <span className="shop-media-dirty">تغييرات غير محفوظة</span> : null}
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

              {previewItems.length > 0 ? (
                <div className="shop-media-preview-strip" aria-hidden="true">
                  {previewItems.map((src, index) => (
                    <img key={index} src={src} alt="" className="shop-media-preview-strip__thumb" />
                  ))}
                </div>
              ) : null}

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
                    <div className="shop-media-list">
                      {section.items.map((item, index) => {
                        const detailOptions = isDetailTargetType(item.targetType)
                          ? targetOptionsByType[item.targetType]
                          : [];
                        const isDetail = isDetailTargetType(item.targetType);
                        const itemKey = `${section.slot}:${item.id}`;
                        const isItemCollapsed = collapsedItems.has(itemKey);
                        const typeLabel = [...listingTargetOptions, ...detailTargetOptions]
                          .find((option) => option.value === item.targetType)?.label ?? item.targetType;
                        const targetMissing = hasMissingTarget(item);
                        const targetSummary = isDetail
                          ? (detailOptions.find((option) => option.id === item.targetId)?.label
                            ?? (targetMissing ? "العنصر محذوف — الصفحة الرئيسية" : "بدون عنصر"))
                          : typeLabel;
                        const thumbSrc = resolvePreviewSrc(
                          item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath
                        );

                        return (
                          <div key={item.id} className="shop-media-item">
                            <div className="shop-media-item__bar">
                              <div className="shop-media-item__bar-start">
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() => toggleCollapsedItem(itemKey)}
                                  aria-label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"}
                                  aria-expanded={!isItemCollapsed}
                                >
                                  <Icon.Chevron size={14} className={isItemCollapsed ? "rotate-180" : undefined} />
                                </button>
                                <span className="shop-media-tile__index">{index + 1}</span>
                                {thumbSrc ? (
                                  <img src={thumbSrc} alt="" className="shop-media-item__thumb" />
                                ) : null}
                                {isItemCollapsed ? (
                                  <span className="faint shop-media-item__summary">{typeLabel} · {targetSummary}</span>
                                ) : null}
                              </div>
                              {canEdit ? (
                                <div className="shop-media-item__bar-end">
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => moveItem(section.slot, item.id, -1)}
                                    aria-label="تحريك لأعلى"
                                    disabled={index === 0}
                                  >
                                    <Icon.Chevron size={14} className="rotate-180" />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={() => moveItem(section.slot, item.id, 1)}
                                    aria-label="تحريك لأسفل"
                                    disabled={index === section.items.length - 1}
                                  >
                                    <Icon.Chevron size={14} />
                                  </button>
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
                                </div>
                              ) : null}
                            </div>

                            {isItemCollapsed ? null : (
                              <div className="shop-media-item__body">
                                <div className="shop-media-item__images">
                                  <ImageUpload
                                    label="صورة سطح المكتب — العربية"
                                    value={item.arImagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, arImagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                  <ImageUpload
                                    label="صورة الموبايل — العربية"
                                    value={item.arMobileImagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, arMobileImagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                  <ImageUpload
                                    label="صورة سطح المكتب — الإنجليزية"
                                    value={item.enImagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, enImagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                  <ImageUpload
                                    label="صورة الموبايل — الإنجليزية"
                                    value={item.enMobileImagePath || null}
                                    onChange={(value) => setSection(section.slot, (current) => ({
                                      ...current,
                                      items: current.items.map((entry) => entry.id === item.id ? { ...entry, enMobileImagePath: value ?? "" } : entry)
                                    }))}
                                    uploadContext="shop_media.update"
                                  />
                                </div>

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
                                          <option key={option.id} value={option.id}>
                                            {`${"— ".repeat(option.depth)}${option.label}`}
                                          </option>
                                        ))}
                                      </select>
                                      {targetMissing ? (
                                        <p className="shop-media-item__missing-target">
                                          العنصر المرتبط محذوف — تفتح هذه الصورة الصفحة الرئيسية حتى تختاري عنصرًا جديدًا.
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="field">
                                      <label>الرابط</label>
                                      <div className="shop-media-item__no-target">صفحة قائمة — بدون عنصر محدد</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {canEdit ? (
                      <button type="button" className="shop-media-add" onClick={() => addItem(section.slot)}>
                        <Icon.Plus /> إضافة صورة
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {error ? <p className="form-error-note">{error}</p> : null}
      </div>
    </AdminShell>
  );
}
