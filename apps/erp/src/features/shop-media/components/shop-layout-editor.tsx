"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Images, LayoutList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SHOP_PAGE_BUILT_IN_BLOCK_TYPES, type Category, type ShopPageBlock, type ShopPageBuiltInBlockType } from "@capella/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { moveItem as moveArrayItem } from "@/lib/array";
import { buildCategoryTreeOptions, type CategoryTreeOption } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { getStore } from "@/lib/store";
import type { ShopPageBlockPayload } from "@/lib/store/types";
import { SectionEditor } from "@/features/shop-media/components/section-editor";
import {
  findSectionError,
  newEditableItem,
  toEditableSection,
  toSectionItemsPayload
} from "@/features/shop-media/lib/editable-section";
import type { EditableItem, EditableSection, EditableShopBlock } from "@/features/shop-media/types";

const MISSING_CATEGORY_MESSAGE = "اختاري قسمًا لكل قسم منتجات قبل الحفظ.";
const TRASHED_CATEGORY_MESSAGE = "أحد الأقسام المختارة محذوف. اختاري قسمًا آخر أو أزيلي القسم قبل الحفظ.";
const EMPTY_PAGE_MESSAGE = "أبقي قسمًا واحدًا على الأقل في صفحة المتجر.";

/** How each built-in section is named and described in the layout. */
const BUILT_IN_SECTIONS: Record<ShopPageBuiltInBlockType, { title: string; description: string }> = {
  genders: { title: "تسوق حسب النوع", description: "صور الأنواع (أولاد، بنات، …) في صف واحد." },
  category_tiles: { title: "الأقسام", description: "الأقسام الرئيسية التي فيها منتجات، مع «عرض الكل»." },
  bestsellers: { title: "الأكثر مبيعًا", description: "المنتجات المعلّمة «الأكثر مبيعًا» مع «عرض الكل»." },
  new: { title: "الأحدث", description: "المنتجات المعلّمة «جديد» مع «عرض الكل»." },
  offers: { title: "العروض", description: "العروض النشطة في صف واحد مع «عرض الكل»." },
  brands: { title: "الماركات", description: "شعارات الماركات التي فيها منتجات، مع «عرض الكل»." },
  collections: { title: "المجموعات", description: "المجموعات النشطة الظاهرة في صف واحد مع «عرض الكل»." }
};

function isBuiltIn(block: EditableShopBlock): block is { key: string; type: ShopPageBuiltInBlockType } {
  return block.type !== "category" && block.type !== "media";
}

function toEditableBlocks(blocks: ShopPageBlock[]): EditableShopBlock[] {
  return blocks.map((block): EditableShopBlock => {
    const key = `block-${block.id}`;
    if (block.type === "category") return { key, type: "category", categoryId: block.categoryId };
    if (block.type === "media") {
      return { key, type: "media", mediaSectionId: block.mediaSection.id, section: toEditableSection(block.mediaSection, `section-${block.mediaSection.id}`) };
    }
    return { key, type: block.type };
  });
}

function toPayload(block: EditableShopBlock): ShopPageBlockPayload {
  if (block.type === "category") return { type: "category", categoryId: block.categoryId! };
  if (block.type === "media") {
    return { type: "media", mediaSectionId: block.mediaSectionId, status: block.section.status, items: toSectionItemsPayload(block.section.items) };
  }
  return { type: block.type };
}

function BlockActions({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (delta: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="تحريك القسم لأعلى" title="تحريك القسم لأعلى" disabled={index <= 0} onClick={() => onMove(-1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="تحريك القسم لأسفل" title="تحريك القسم لأسفل" disabled={index >= count - 1} onClick={() => onMove(1)}>
        <ArrowDown />
      </Button>
      <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة القسم" title="إزالة القسم" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

type ShopLayoutEditorProps = {
  storedBlocks: ShopPageBlock[];
  categories: Category[];
  canEdit: boolean;
  targetOptionsByType: Record<"product" | "offer" | "collection" | "category", CategoryTreeOption[]>;
  hasMissingTarget: (item: EditableItem) => boolean;
  collapsedSections: ReadonlySet<string>;
  toggleCollapsedSection: (key: string) => void;
  collapsedItems: ReadonlySet<string>;
  toggleCollapsedItem: (key: string) => void;
};

/**
 * The shop page from just under the header down to Falta & Zoobi, in the order it shows: built-in sections (each at most
 * once), category product rows and picture sections. Moving, removing and adding are all saved together with one button.
 */
export function ShopLayoutEditor({
  storedBlocks, categories, canEdit, targetOptionsByType, hasMissingTarget,
  collapsedSections, toggleCollapsedSection, collapsedItems, toggleCollapsedItem
}: ShopLayoutEditorProps) {
  const [blocks, setBlocks] = useState<EditableShopBlock[]>(() => toEditableBlocks(storedBlocks));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store refreshes replace the list only while nothing is being edited, so unsaved changes are never lost; after a save, the fresh list (with new ids) comes in.
  useEffect(() => {
    if (!dirty) {
      setBlocks(toEditableBlocks(storedBlocks));
    }
  }, [storedBlocks, dirty]);

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  const liveCategoryIds = useMemo(() => new Set(categoryOptions.map((option) => option.id)), [categoryOptions]);
  const isTrashedCategory = (block: EditableShopBlock) => block.type === "category" && block.categoryId != null && !liveCategoryIds.has(block.categoryId);
  const missingBuiltIns = SHOP_PAGE_BUILT_IN_BLOCK_TYPES.filter((type) => !blocks.some((block) => block.type === type));

  const update = (updater: (current: EditableShopBlock[]) => EditableShopBlock[]) => {
    setDirty(true);
    setBlocks(updater);
  };

  const setSection = (key: string, updater: (current: EditableSection) => EditableSection) => update((current) => current.map((block) => (
    block.type === "media" && block.section.key === key ? { ...block, section: updater(block.section) } : block
  )));

  const addBuiltIn = (type: ShopPageBuiltInBlockType) => update((current) => [...current, { key: `new-${crypto.randomUUID()}`, type }]);
  const addCategoryBlock = () => update((current) => [...current, { key: `new-${crypto.randomUUID()}`, type: "category", categoryId: null }]);
  const addMediaBlock = () => update((current) => {
    const key = `new-${crypto.randomUUID()}`;
    return [...current, { key, type: "media", mediaSectionId: null, section: { key, status: "active", items: [] } }];
  });

  const moveBlock = (index: number, delta: -1 | 1) => update((current) => moveArrayItem(current, index, delta));
  const removeBlock = (key: string) => update((current) => current.filter((block) => block.key !== key));

  const fail = (message: string) => {
    setError(message);
    showErrorToast(new Error(message), message);
  };

  const save = async () => {
    if (blocks.length === 0) {
      fail(EMPTY_PAGE_MESSAGE);
      return;
    }
    if (blocks.some((block) => block.type === "category" && block.categoryId == null)) {
      fail(MISSING_CATEGORY_MESSAGE);
      return;
    }
    if (blocks.some(isTrashedCategory)) {
      fail(TRASHED_CATEGORY_MESSAGE);
      return;
    }
    for (const block of blocks) {
      const sectionError = block.type === "media" ? findSectionError(block.section, hasMissingTarget) : null;
      if (sectionError) {
        fail(sectionError);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      await getStore().replaceShopLayout(blocks.map(toPayload));
      setDirty(false);
      toast.success("تم حفظ ترتيب صفحة المتجر.");
    } catch {
      fail("تعذر حفظ ترتيب صفحة المتجر. حاولي مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-md font-bold">ترتيب صفحة المتجر</h2>
            <p className="text-sm text-text-muted">
              الأقسام من أسفل القائمة حتى «فلتة وزوبي»، بنفس الترتيب الذي تظهر به في المتجر. شريط الإعلانات والقائمة و«فلتة وزوبي» ثابتة في أماكنها. قسم المنتجات يعرض أحدث ١٢ منتجًا من القسم وكل ما تحته.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
              <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => { void save(); }}>
                {saving ? "جارٍ الحفظ…" : "حفظ الترتيب"}
              </Button>
            </div>
          ) : null}
        </header>
        {canEdit ? (
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={addMediaBlock}>
              <Images /> إضافة قسم صور
            </Button>
            <Button variant="secondary" size="sm" onClick={addCategoryBlock}>
              <LayoutList /> إضافة قسم منتجات
            </Button>
            {missingBuiltIns.map((type) => (
              <Button key={type} variant="secondary" size="sm" onClick={() => addBuiltIn(type)}>
                <Plus /> {`إضافة «${BUILT_IN_SECTIONS[type].title}»`}
              </Button>
            ))}
          </CardBody>
        ) : null}
        {blocks.length === 0 ? (
          <CardBody>
            <p className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center text-sm text-text-muted">
              لا توجد أقسام في صفحة المتجر.
            </p>
          </CardBody>
        ) : null}
      </Card>

      {blocks.length > 0 ? (
        <ol className="grid gap-4">
          {blocks.map((block, index) => {
            const actions = canEdit ? (
              <BlockActions index={index} count={blocks.length} onMove={(delta) => moveBlock(index, delta)} onRemove={() => removeBlock(block.key)} />
            ) : null;

            if (block.type === "media") {
              return (
                <li key={block.key} data-shop-section>
                  <SectionEditor
                    section={block.section}
                    title={`${index + 1}. قسم صور`}
                    description="صور بعرض الصفحة. أول قسم صور في الصفحة يُحمَّل أولًا."
                    headerActions={actions}
                    isCollapsed={collapsedSections.has(block.section.key)}
                    canEdit={canEdit}
                    collapsedItems={collapsedItems}
                    targetOptionsByType={targetOptionsByType}
                    toggleCollapsed={toggleCollapsedSection}
                    toggleCollapsedItem={toggleCollapsedItem}
                    setSection={setSection}
                    addItem={(key) => setSection(key, (current) => ({ ...current, items: [...current.items, newEditableItem()] }))}
                    moveItem={(key, id, direction) => setSection(key, (current) => {
                      const itemIndex = current.items.findIndex((entry) => entry.id === id);
                      if (itemIndex === -1) return current;
                      const items = moveArrayItem(current.items, itemIndex, direction);
                      return items === current.items ? current : { ...current, items };
                    })}
                    hasMissingTarget={hasMissingTarget}
                  />
                </li>
              );
            }

            if (isBuiltIn(block)) {
              const { title, description } = BUILT_IN_SECTIONS[block.type];
              return (
                <li key={block.key} data-shop-section>
                  <Card>
                    <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                      <div className="min-w-0">
                        <h2 className="text-md font-bold">{`${index + 1}. ${title}`}</h2>
                        <p className="text-sm text-text-muted">{description}</p>
                      </div>
                      {actions}
                    </header>
                  </Card>
                </li>
              );
            }

            // Each category may lead only one section, so categories already used elsewhere are left out of this picker.
            const usedElsewhere = new Set(blocks.flatMap((other) => (
              other.key !== block.key && other.type === "category" && other.categoryId != null ? [other.categoryId] : []
            )));
            const options = categoryOptions.filter((option) => !usedElsewhere.has(option.id));
            const selectId = `shop-category-${block.key}`;

            return (
              <li key={block.key} data-shop-section>
                <Card>
                  <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
                    <div className="min-w-0">
                      <h2 className="text-md font-bold">{`${index + 1}. قسم منتجات`}</h2>
                      <p className="text-sm text-text-muted">صف من أحدث منتجات القسم وكل ما تحته، مع رابط «عرض الكل».</p>
                    </div>
                    {actions}
                  </header>
                  <CardBody>
                    <Field label="القسم" htmlFor={selectId}>
                      <Select
                        id={selectId}
                        value={block.categoryId ?? ""}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const categoryId = event.target.value ? Number(event.target.value) : null;
                          update((current) => current.map((entry) => (entry.key === block.key && entry.type === "category" ? { ...entry, categoryId } : entry)));
                        }}
                      >
                        <option value="">اختاري قسمًا</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.label}`}</option>
                        ))}
                      </Select>
                    </Field>
                    {isTrashedCategory(block) ? (
                      <p className="mt-2 text-sm text-warning">القسم المختار محذوف، لذلك لا يظهر هذا القسم في المتجر. اختاري قسمًا آخر أو أزيلي القسم.</p>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
