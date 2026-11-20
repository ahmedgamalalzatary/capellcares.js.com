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
import {
  findSectionError,
  isDetailTargetType,
  newEditableItem,
  toEditableSection,
  toSectionItemsPayload
} from "@/features/shop-media/lib/editable-section";
import { AnnouncementsEditor } from "@/features/shop-media/components/announcements-editor";
import { CustomSectionsEditor } from "@/features/shop-media/components/custom-sections-editor";
import { SectionEditor } from "@/features/shop-media/components/section-editor";

/** The top banner is the only picture section with a fixed place; every other picture section lives in the custom sections tab. */
const TOP_BANNER_KEY = "top";

export default function ShopMediaPage() {
  const { user } = useAdminAuth();
  const shopMediaSections = useStore((store) => store.shopMediaSections);
  const shopCustomBlocks = useStore((store) => store.shopCustomBlocks);
  const storedAnnouncements = useStore((store) => store.announcements);
  const storedBarStatus = useStore((store) => store.announcementBarStatus);
  const products = useStore((store) => store.products);
  const categories = useStore((store) => store.categories);
  const offers = useStore((store) => store.offers);
  const collections = useStore((store) => store.collections);
  const [topBanner, setTopBanner] = useState<EditableSection>(() => toEditableSection(undefined, TOP_BANNER_KEY));
  const [tab, setTab] = useState<"images" | "custom" | "announcements">("images");
  const [announcementItems, setAnnouncementItems] = useState<EditableAnnouncement[]>([]);
  const [barStatus, setBarStatus] = useState<"active" | "inactive">("active");
  const [savingTopBanner, setSavingTopBanner] = useState(false);
  const [savingAnnouncements, setSavingAnnouncements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topBannerDirtyRef = useRef(false);
  const [topBannerDirty, setTopBannerDirty] = useState(false);
  const announcementsDirtyRef = useRef(false);
  const [announcementsDirty, setAnnouncementsDirty] = useState(false);
  const { collapsed: collapsedSections, toggle: toggleCollapsed } = useCollapsedShopMedia();
  const { collapsed: collapsedItems, toggle: toggleCollapsedItem } = useCollapsedShopMediaItems();

  useEffect(() => {
    if (topBannerDirtyRef.current) {
      return;
    }
    setTopBanner(toEditableSection(shopMediaSections.find((section) => section.slot === 1), TOP_BANNER_KEY));
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

  const setSection = (_key: string, updater: (current: EditableSection) => EditableSection) => {
    topBannerDirtyRef.current = true;
    setTopBannerDirty(true);
    setTopBanner(updater);
  };

  const saveSection = async (section: EditableSection) => {
    const sectionError = findSectionError(section, hasMissingTarget);
    if (sectionError) {
      const validationError = new Error(sectionError);
      setError(sectionError);
      showErrorToast(validationError, sectionError);
      return;
    }
    try {
      setSavingTopBanner(true);
      setError(null);
      await getStore().updateShopMediaSection(1, {
        status: section.status,
        items: toSectionItemsPayload(section.items)
      });
      topBannerDirtyRef.current = false;
      setTopBannerDirty(false);
      toast.success("تم حفظ القسم بنجاح.");
    } catch {
      const saveError = new Error("تعذر حفظ القسم. حاولي مرة أخرى.");
      setError(saveError.message);
      showErrorToast(saveError, saveError.message);
    } finally {
      setSavingTopBanner(false);
    }
  };

  const addItem = (key: string) => setSection(key, (current) => ({
    ...current,
    items: [...current.items, newEditableItem()]
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

  const moveItem = (key: string, itemId: string, direction: -1 | 1) => setSection(key, (current) => {
    const index = current.items.findIndex((entry) => entry.id === itemId);
    if (index === -1) {
      return current;
    }
    const items = moveArrayItem(current.items, index, direction);
    return items === current.items ? current : { ...current, items };
  });

  const tabs = [
    { value: "images", label: "أقسام الصور" },
    { value: "custom", label: "الأقسام المخصصة" },
    { value: "announcements", label: "شريط الإعلانات" }
  ] as const;

  return (
    <AdminShell
      title="وسائط المتجر"
      crumbs={[{ label: "وسائط المتجر" }]}
      description="صورة أعلى المتجر، والأقسام المخصصة، وشريط الإعلانات في واجهة المتجر."
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="وسائط المتجر">
          {tabs.map((entry) => (
            <Button
              key={entry.value}
              variant={tab === entry.value ? "primary" : "ghost"}
              size="sm"
              role="tab"
              aria-selected={tab === entry.value}
              onClick={() => setTab(entry.value)}
            >
              {entry.label}
            </Button>
          ))}
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

        {tab === "images" ? (
          <SectionEditor
            section={topBanner}
            title="صورة أعلى المتجر"
            description="تظهر أعلى صفحة المتجر. باقي أقسام الصور في تبويب «الأقسام المخصصة»."
            isDirty={topBannerDirty}
            isSaving={savingTopBanner}
            saveSection={saveSection}
            isCollapsed={collapsedSections.has(topBanner.key)}
            canEdit={canEdit}
            collapsedItems={collapsedItems}
            targetOptionsByType={targetOptionsByType}
            toggleCollapsed={toggleCollapsed}
            toggleCollapsedItem={toggleCollapsedItem}
            setSection={setSection}
            addItem={addItem}
            moveItem={moveItem}
            hasMissingTarget={hasMissingTarget}
          />
        ) : null}

        {/* Kept mounted while hidden so unsaved custom-section edits survive switching tabs. */}
        <div hidden={tab !== "custom"}>
          <CustomSectionsEditor
            storedBlocks={shopCustomBlocks ?? []}
            categories={categories}
            canEdit={canEdit}
            targetOptionsByType={targetOptionsByType}
            hasMissingTarget={hasMissingTarget}
            collapsedSections={collapsedSections}
            toggleCollapsedSection={toggleCollapsed}
            collapsedItems={collapsedItems}
            toggleCollapsedItem={toggleCollapsedItem}
          />
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </AdminShell>
  );
}
