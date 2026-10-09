"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { SingleImageField } from "@/components/forms/single-image-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Thumb } from "@/components/ui/thumb";
import { showErrorToast } from "@/lib/errors";
import { getStore, useStore } from "@/lib/store";
import { resolveMediaSrc } from "@/lib/media";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useCollapsedShopMedia } from "@/hooks/use-collapsed-shop-media";
import { useCollapsedShopMediaItems } from "@/hooks/use-collapsed-shop-media-items";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Announcement, ShopMediaSection, ShopMediaTargetType } from "@capella/shared";

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

type EditableAnnouncement = {
  id: string;
  arText: string;
  enText: string;
  status: "active" | "inactive";
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

function FoldButton({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      onClick={onClick}
    >
      <ChevronDown className={cn("transition-transform duration-200", collapsed && "rotate-180")} />
    </Button>
  );
}

export default function ShopMediaPage() {
  const { user } = useAdminAuth();
  const shopMediaSections = useStore((store) => store.shopMediaSections);
  const storedAnnouncements = useStore((store) => store.announcements);
  const storedBarStatus = useStore((store) => store.announcementBarStatus);
  const products = useStore((store) => store.products);
  const categories = useStore((store) => store.categories);
  const offers = useStore((store) => store.offers);
  const collections = useStore((store) => store.collections);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [tab, setTab] = useState<"announcements" | "images">("images");
  const [announcementItems, setAnnouncementItems] = useState<EditableAnnouncement[]>([]);
  const [barStatus, setBarStatus] = useState<"active" | "inactive">("active");
  const [savingSlot, setSavingSlot] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [savingAnnouncements, setSavingAnnouncements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtySlotsRef = useRef<Set<1 | 2 | 3 | 4 | 5>>(new Set());
  const [dirtySlots, setDirtySlots] = useState<Set<1 | 2 | 3 | 4 | 5>>(new Set());
  const announcementsDirtyRef = useRef(false);
  const [announcementsDirty, setAnnouncementsDirty] = useState(false);
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

  useEffect(() => {
    if (announcementsDirtyRef.current) {
      return;
    }
    setAnnouncementItems((storedAnnouncements ?? []).map((item: Announcement) => ({
      id: String(item.id),
      arText: item.arText,
      enText: item.enText,
      status: item.status
    })));
    setBarStatus(storedBarStatus ?? "active");
  }, [storedAnnouncements, storedBarStatus]);

  // Soft-deleted entities still live in the store (the trash page reads them from these same slices), so every target picker has to exclude them itself.
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

  // A target deleted after the banner was set no longer resolves to an option: the storefront falls back to the home page, and the API refuses a deleted target, so saving stays blocked until a live one is chosen.
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
      !item.arImagePath && !item.arMobileImagePath && !item.enImagePath && !item.enMobileImagePath
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

  const markAnnouncementsDirty = (updater: (current: EditableAnnouncement[]) => EditableAnnouncement[]) => {
    announcementsDirtyRef.current = true;
    setAnnouncementsDirty(true);
    setAnnouncementItems(updater);
  };

  const setBarStatusDirty = (status: "active" | "inactive") => {
    announcementsDirtyRef.current = true;
    setAnnouncementsDirty(true);
    setBarStatus(status);
  };

  const addAnnouncement = () => markAnnouncementsDirty((current) => [
    ...current,
    { id: crypto.randomUUID(), arText: "", enText: "", status: "active" }
  ]);

  const saveAnnouncements = async () => {
    if (announcementItems.some((item) => !item.arText.trim() || !item.enText.trim())) {
      const validationError = new Error("أضيفي النص العربي والإنجليزي لكل إعلان قبل الحفظ.");
      setError(validationError.message);
      showErrorToast(validationError, validationError.message);
      return;
    }
    try {
      setSavingAnnouncements(true);
      setError(null);
      await getStore().replaceAnnouncements({
        barStatus,
        items: announcementItems.map((item, index) => ({
          arText: item.arText.trim(),
          enText: item.enText.trim(),
          status: item.status,
          sortOrder: index + 1
        }))
      });
      announcementsDirtyRef.current = false;
      setAnnouncementsDirty(false);
      toast.success("تم حفظ الإعلانات بنجاح.");
    } catch {
      const saveError = new Error("تعذر حفظ الإعلانات. حاولي مرة أخرى.");
      setError(saveError.message);
      showErrorToast(saveError, saveError.message);
    } finally {
      setSavingAnnouncements(false);
    }
  };

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
    <AdminShell
      title="وسائط المتجر"
      crumbs={[{ label: "وسائط المتجر" }]}
      description="أقسام الصور وشريط الإعلانات في واجهة المتجر."
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="وسائط المتجر">
          <Button variant={tab === "images" ? "primary" : "ghost"} size="sm" role="tab" aria-selected={tab === "images"} onClick={() => setTab("images")}>
            أقسام الصور
          </Button>
          <Button variant={tab === "announcements" ? "primary" : "ghost"} size="sm" role="tab" aria-selected={tab === "announcements"} onClick={() => setTab("announcements")}>
            شريط الإعلانات
          </Button>
        </div>

        {tab === "announcements" ? (() => {
          const isAnnouncementsCollapsed = collapsedItems.has("announcements");
          return (
            <Card>
              <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <FoldButton collapsed={isAnnouncementsCollapsed} onClick={() => toggleCollapsedItem("announcements")} label={isAnnouncementsCollapsed ? "توسيع القسم" : "طي القسم"} />
                  <div className="min-w-0">
                    <h2 className="text-md font-bold">شريط الإعلانات</h2>
                    <p className="text-sm text-text-muted">يظهر أعلى المتجر ويتبدّل بين الرسائل النشطة.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="neutral" swatch={false}>{announcementItems.length} رسالة</Badge>
                  {announcementsDirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
                  {canEdit ? (
                    <>
                      <label className="flex items-center gap-2 text-sm text-text-2">
                        <Switch checked={barStatus === "active"} onCheckedChange={(checked) => setBarStatusDirty(checked ? "active" : "inactive")} aria-label="تفعيل شريط الإعلانات" />
                        {barStatus === "active" ? "الشريط ظاهر" : "الشريط مخفي"}
                      </label>
                      <Button variant="primary" size="sm" disabled={savingAnnouncements || !announcementsDirty} onClick={() => { void saveAnnouncements(); }}>
                        {savingAnnouncements ? "جارٍ الحفظ…" : "حفظ الإعلانات"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </header>

              {isAnnouncementsCollapsed ? null : (
                <CardBody className="grid gap-3">
                  {announcementItems.length === 0 ? (
                    <div className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center text-sm text-text-muted">
                      لا توجد رسائل إعلانية بعد.
                    </div>
                  ) : (
                    <ol className="grid gap-3">
                      {announcementItems.map((item, index) => {
                        const itemKey = `announcement:${item.id}`;
                        const isItemCollapsed = collapsedItems.has(itemKey);
                        const summary = item.arText.trim() || item.enText.trim() || "بدون نص";
                        return (
                          <li key={item.id} className="grid gap-3 rounded-well bg-sunken p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <FoldButton collapsed={isItemCollapsed} onClick={() => toggleCollapsedItem(itemKey)} label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"} />
                                <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-text-2 shadow-inset">{index + 1}</span>
                                {isItemCollapsed ? <span className="truncate text-sm text-text-muted">{summary}</span> : null}
                              </div>
                              {canEdit ? (
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 text-sm text-text-2">
                                    <Switch
                                      checked={item.status === "active"}
                                      onCheckedChange={(checked) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: checked ? "active" : "inactive" } : entry))}
                                      aria-label="تفعيل الإعلان"
                                    />
                                    {item.status === "active" ? "نشط" : "غير نشط"}
                                  </label>
                                  <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => markAnnouncementsDirty((current) => {
                                    if (index === 0) return current;
                                    const next = [...current];
                                    const [moved] = next.splice(index, 1);
                                    next.splice(index - 1, 0, moved!);
                                    return next;
                                  })}>
                                    <ArrowUp />
                                  </Button>
                                  <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" disabled={index === announcementItems.length - 1} onClick={() => markAnnouncementsDirty((current) => {
                                    if (index >= current.length - 1) return current;
                                    const next = [...current];
                                    const [moved] = next.splice(index, 1);
                                    next.splice(index + 1, 0, moved!);
                                    return next;
                                  })}>
                                    <ArrowDown />
                                  </Button>
                                  <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة الإعلان" onClick={() => markAnnouncementsDirty((current) => current.filter((entry) => entry.id !== item.id))}>
                                    <Trash2 />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            {isItemCollapsed ? null : (
                              <div className="grid gap-3 @lg:grid-cols-2">
                                <Field label="النص العربي" htmlFor={`announcement-ar-${item.id}`}>
                                  <Input id={`announcement-ar-${item.id}`} value={item.arText} disabled={!canEdit} onChange={(event) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, arText: event.target.value } : entry))} />
                                </Field>
                                <Field label="النص بالإنجليزية" htmlFor={`announcement-en-${item.id}`}>
                                  <Input id={`announcement-en-${item.id}`} dir="ltr" value={item.enText} disabled={!canEdit} onChange={(event) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, enText: event.target.value } : entry))} />
                                </Field>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {canEdit ? (
                    <Button variant="secondary" size="sm" className="justify-self-start" onClick={addAnnouncement}>
                      <Plus /> إضافة إعلان
                    </Button>
                  ) : null}
                </CardBody>
              )}
            </Card>
          );
        })() : null}

        {tab === "images" ? sections.map((section) => {
          const isActive = section.status === "active";
          const isDirty = dirtySlots.has(section.slot);
          const isSaving = savingSlot === section.slot;
          const isCollapsed = collapsedSlots.has(section.slot);
          const previewItems = section.items
            .map((item) => resolveMediaSrc(item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath))
            .filter((src): src is string => Boolean(src));

          return (
            <Card key={section.slot}>
              <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <FoldButton collapsed={isCollapsed} onClick={() => toggleCollapsed(section.slot)} label={isCollapsed ? "توسيع القسم" : "طي القسم"} />
                  <div className="min-w-0">
                    <h2 className="text-md font-bold">القسم {section.slot}</h2>
                    <p className="text-sm text-text-muted">{slotPositionLabel[section.slot]}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="neutral" swatch={false}>{section.items.length} صورة</Badge>
                  {canEdit ? (
                    <>
                      <label className="flex items-center gap-2 text-sm text-text-2">
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => setSection(section.slot, (current) => ({ ...current, status: current.status === "active" ? "inactive" : "active" }))}
                          aria-label="تفعيل القسم"
                        />
                        {isActive ? "نشط" : "غير نشط"}
                      </label>
                      {isDirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
                      <Button variant="primary" size="sm" disabled={!isDirty || isSaving} onClick={() => { void saveSection(section); }}>
                        {isSaving ? "جارٍ الحفظ…" : "حفظ القسم"}
                      </Button>
                    </>
                  ) : (
                    <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "نشط" : "غير نشط"}</Badge>
                  )}
                </div>
              </header>

              {previewItems.length > 0 ? (
                <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6" aria-hidden="true">
                  {previewItems.map((src, index) => (
                    <Thumb key={index} src={src} size="md" className="rounded-thumb" />
                  ))}
                </div>
              ) : null}

              {isCollapsed ? null : (
                <CardBody className="grid gap-3">
                  {section.items.length === 0 ? (
                    <div className="grid justify-items-center gap-3 rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center">
                      <p className="text-sm text-text-muted">لا توجد صور في هذا القسم بعد.</p>
                      {canEdit ? (
                        <Button variant="secondary" size="sm" onClick={() => addItem(section.slot)}>
                          <Plus /> أضيفي أول صورة
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <ol className="grid gap-3">
                        {section.items.map((item, index) => {
                          const detailOptions = isDetailTargetType(item.targetType) ? targetOptionsByType[item.targetType] : [];
                          const isDetail = isDetailTargetType(item.targetType);
                          const itemKey = `${section.slot}:${item.id}`;
                          const isItemCollapsed = collapsedItems.has(itemKey);
                          const typeLabel = [...listingTargetOptions, ...detailTargetOptions].find((option) => option.value === item.targetType)?.label ?? item.targetType;
                          const targetMissing = hasMissingTarget(item);
                          const targetSummary = isDetail
                            ? (detailOptions.find((option) => option.id === item.targetId)?.label ?? (targetMissing ? "العنصر محذوف — الصفحة الرئيسية" : "بدون عنصر"))
                            : typeLabel;
                          const thumbSrc = resolveMediaSrc(item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath);

                          return (
                            <li key={item.id} className="grid gap-3 rounded-well bg-sunken p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <FoldButton collapsed={isItemCollapsed} onClick={() => toggleCollapsedItem(itemKey)} label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"} />
                                  <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-text-2 shadow-inset">{index + 1}</span>
                                  {thumbSrc ? <Thumb src={thumbSrc} size="sm" /> : null}
                                  {isItemCollapsed ? <span className="truncate text-sm text-text-muted">{typeLabel} · {targetSummary}</span> : null}
                                </div>
                                {canEdit ? (
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => moveItem(section.slot, item.id, -1)}>
                                      <ArrowUp />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" disabled={index === section.items.length - 1} onClick={() => moveItem(section.slot, item.id, 1)}>
                                      <ArrowDown />
                                    </Button>
                                    <Button
                                      variant="danger-ghost"
                                      size="icon-sm"
                                      aria-label="إزالة الصورة"
                                      onClick={() => setSection(section.slot, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </div>
                                ) : null}
                              </div>

                              {isItemCollapsed ? null : (
                                <div className="grid gap-4">
                                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <SingleImageField label="سطح المكتب — العربية" value={item.arImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, arImagePath: value ?? "" } : entry) }))} />
                                    <SingleImageField label="الموبايل — العربية" value={item.arMobileImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, arMobileImagePath: value ?? "" } : entry) }))} />
                                    <SingleImageField label="سطح المكتب — الإنجليزية" value={item.enImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, enImagePath: value ?? "" } : entry) }))} />
                                    <SingleImageField label="الموبايل — الإنجليزية" value={item.enMobileImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, enMobileImagePath: value ?? "" } : entry) }))} />
                                  </div>

                                  <div className="grid gap-3 @lg:grid-cols-2">
                                    <Field label="نوع الوجهة" htmlFor={`target-type-${section.slot}-${item.id}`}>
                                      <Select
                                        id={`target-type-${section.slot}-${item.id}`}
                                        value={item.targetType}
                                        disabled={!canEdit}
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
                                      >
                                        {listingTargetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        {detailTargetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </Select>
                                    </Field>

                                    {isDetail ? (
                                      <Field label="العنصر" htmlFor={`target-id-${section.slot}-${item.id}`}>
                                        <Select
                                          id={`target-id-${section.slot}-${item.id}`}
                                          value={item.targetId ?? ""}
                                          disabled={!canEdit}
                                          onChange={(event) => setSection(section.slot, (current) => ({
                                            ...current,
                                            items: current.items.map((entry) => entry.id === item.id ? { ...entry, targetId: event.target.value ? Number(event.target.value) : null } : entry)
                                          }))}
                                        >
                                          <option value="">اختاري عنصرًا</option>
                                          {detailOptions.map((option) => (
                                            <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.label}`}</option>
                                          ))}
                                        </Select>
                                      </Field>
                                    ) : (
                                      <Field label="الرابط">
                                        <div className="flex h-10 items-center rounded-control bg-surface px-3 text-sm text-text-muted shadow-[inset_0_0_0_1px_var(--line)] pointer-coarse:h-11">
                                          صفحة قائمة — بدون عنصر محدد
                                        </div>
                                      </Field>
                                    )}
                                  </div>
                                  {targetMissing ? (
                                    <p className="text-sm text-warning">العنصر المرتبط محذوف — تفتح هذه الصورة الصفحة الرئيسية حتى تختاري عنصرًا جديدًا.</p>
                                  ) : null}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ol>

                      {canEdit ? (
                        <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => addItem(section.slot)}>
                          <Plus /> إضافة صورة
                        </Button>
                      ) : null}
                    </>
                  )}
                </CardBody>
              )}
            </Card>
          );
        }) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </AdminShell>
  );
}
