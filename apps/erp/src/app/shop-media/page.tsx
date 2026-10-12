"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/lib/errors";
import { moveItem as moveArrayItem } from "@/lib/array";
import { getStore, useStore } from "@/lib/store";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { useCollapsedShopMedia } from "@/features/shop-media/hooks/use-collapsed-shop-media";
import { useCollapsedShopMediaItems } from "@/features/shop-media/hooks/use-collapsed-shop-media-items";
import { buildCategoryTreeOptions } from "@/lib/category-tree";
import type { Announcement } from "@capella/shared";
import type { EditableAnnouncement, EditableItem, EditableSection } from "@/features/shop-media/types";
import { isDetailTargetType, toEditableSection } from "@/features/shop-media/lib/editable-section";
import { AnnouncementsEditor } from "@/features/shop-media/components/announcements-editor";
import { SectionEditor } from "@/features/shop-media/components/section-editor";

const SHOP_MEDIA_SLOTS = [1, 2, 3, 4, 5] as const;

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
      <ForbiddenPage title="وسائط المتجر" crumbs={[{ label: "وسائط المتجر" }]} message="لا تملكين صلاحية الوصول إلى وسائط المتجر." />
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
        id: crypto.randomUUID(),
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
    if (index === -1) {
      return current;
    }
    const items = moveArrayItem(current.items, index, direction);
    return items === current.items ? current : { ...current, items };
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

        {tab === "announcements" ? (
          <AnnouncementsEditor
            announcementItems={announcementItems}
            barStatus={barStatus}
            announcementsDirty={announcementsDirty}
            savingAnnouncements={savingAnnouncements}
            canEdit={canEdit}
            collapsedItems={collapsedItems}
            toggleCollapsedItem={toggleCollapsedItem}
            markAnnouncementsDirty={markAnnouncementsDirty}
            setBarStatusDirty={setBarStatusDirty}
            saveAnnouncements={saveAnnouncements}
            addAnnouncement={addAnnouncement}
          />
        ) : null}

        {tab === "images" ? sections.map((section) => (
          <SectionEditor
            key={section.slot}
            section={section}
            isDirty={dirtySlots.has(section.slot)}
            isSaving={savingSlot === section.slot}
            isCollapsed={collapsedSlots.has(section.slot)}
            canEdit={canEdit}
            collapsedItems={collapsedItems}
            targetOptionsByType={targetOptionsByType}
            toggleCollapsed={toggleCollapsed}
            toggleCollapsedItem={toggleCollapsedItem}
            setSection={setSection}
            saveSection={saveSection}
            addItem={addItem}
            moveItem={moveItem}
            hasMissingTarget={hasMissingTarget}
          />
        )) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </AdminShell>
  );
}
